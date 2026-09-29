// Cloudflare Worker pre appku TJ Klas Beša.
// Stiahne stránku zápasu zo Sportnetu a vráti z nej len potrebné údaje (skóre, minúta, góly, karty, zostavy, rozhodcovia).
// Použitie: https://TVOJ-WORKER.workers.dev/?zapas=https://sportnet.sme.sk/futbalnet/z/.../zapas/.../

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=30',
};

function rscText(html) {
  let out = '';
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html))) { try { out += JSON.parse('"' + m[1] + '"'); } catch (e) {} }
  return out;
}

function readJson(t, i) {
  // nájde koniec JSON objektu začínajúceho na pozícii i
  let depth = 0, str = false, esc = false;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return JSON.parse(t.slice(i, j + 1)); }
  }
  throw new Error('neukončený JSON');
}

function compact(m) {
  const teams = m.teams || [];
  const side = {}, names = {};
  teams.forEach(t => { const s = (t.additionalProperties || {}).homeaway === 'home' ? 'home' : 'away'; side[t._id] = s; names[s] = t.name; });
  const events = ((m.protocol || {}).events || []).map(e => ({
    t: e.eventType, k: e.type, ph: e.phase, min: (e.eventTime || '').split(':')[0], side: side[e.team],
    p: (e.player || {}).name, r: (e.replacement || {}).name,
  }));
  const lineups = {};
  (m.nominations || []).forEach(n => {
    const s = side[n.teamId]; if (!s) return;
    lineups[s] = {
      players: (n.athletes || []).map(a => { const ad = a.additionalData || {}; return { nr: ad.nr, name: (a.sportnetUser || {}).name, sub: !!ad.substitute, c: !!ad.captain, gk: ad.position === 'goalkeeper' }; }),
      crew: (n.crew || []).map(c => ({ pos: c.position, name: (c.sportnetUser || {}).name })),
    };
  });
  return {
    id: m._id, status: m.__issfMatchStatus, closed: !!m.closed, start: m.startDate, round: (m.round || {}).name,
    comp: (m.competition || {}).name, ground: (m.sportGround || {}).name, home: names.home, away: names.away,
    score: m.score, phases: m.scoreByPhases, timer: m.timer || null,
    refs: (m.managers || []).map(x => ({ role: (x.type || {}).label, name: (x.user || {}).name })),
    events, lineups, at: new Date().toISOString(), live: true,
  };
}

async function handle(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(request.url).searchParams.get('zapas') || '';
  if (!/^https:\/\/sportnet\.sme\.sk\/futbalnet\/z\/[^?#]+\/zapas\/[a-z0-9]+\/?$/i.test(u)) {
    return new Response(JSON.stringify({ error: 'Zlý odkaz na zápas' }), { status: 400, headers: CORS });
  }
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (TJ Klas Besa app)' } });
  if (!r.ok) return new Response(JSON.stringify({ error: 'Sportnet ' + r.status }), { status: 502, headers: CORS });
  const t = rscText(await r.text());
  const i = t.indexOf('"match":{"_id"');
  if (i < 0) return new Response(JSON.stringify({ error: 'Zápas sa v stránke nenašiel' }), { status: 502, headers: CORS });
  return new Response(JSON.stringify(compact(readJson(t, i + 8))), { headers: CORS });
}

export default {
  async fetch(request) {
    try { return await handle(request); }
    catch (e) { return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: CORS }); }
  },
};
