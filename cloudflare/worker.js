// Cloudflare Worker pre appku TJ Klas Beša.
//  1) Živé zápasy: /?zapas=<odkaz na zápas na Sportnete>  -> skóre, minúta, góly, karty, zostavy, rozhodcovia
//  2) Dochádzka:   /dochadzka?ids=a,b,c  (GET)  a  POST /dochadzka {id, meno, o: "ano" | "nie" | ""}
//     Potrebuje KV úložisko pripojené pod názvom DOCHADZKA (Settings > Bindings > KV namespace).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

function geo(g) {
  const c = (((g || {}).geo || {}).coordinates || []).slice(0, 2).map(Number);
  if (c.length !== 2 || !c[0] || !c[1]) return null;
  return [Math.max(c[0], c[1]), Math.min(c[0], c[1])];
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
    comp: (m.competition || {}).name, ground: (m.sportGround || {}).name, geo: geo(m.sportGround), home: names.home, away: names.away,
    score: m.score, phases: m.scoreByPhases, timer: m.timer || null,
    refs: (m.managers || []).map(x => ({ role: (x.type || {}).label, name: (x.user || {}).name })),
    events, lineups, at: new Date().toISOString(), live: true,
  };
}

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, ...extra } });

async function live(request, ctx) {
  const u = new URL(request.url).searchParams.get('zapas') || '';
  if (!/^https:\/\/sportnet\.sme\.sk\/futbalnet\/z\/[^?#]+\/zapas\/[a-z0-9]+\/?$/i.test(u)) return json({ error: 'Zlý odkaz na zápas' }, 400);
  // krátka pamäť, aby Sportnet nedostal od každého hráča zvlášť rovnakú požiadavku
  const cache = caches.default, key = new Request('https://cache.tjklas/' + encodeURIComponent(u));
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { headers: CORS });
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (TJ Klas Besa app)' } });
  if (!r.ok) return json({ error: 'Sportnet ' + r.status }, 502);
  const t = rscText(await r.text());
  const i = t.indexOf('"match":{"_id"');
  if (i < 0) return json({ error: 'Zápas sa v stránke nenašiel' }, 502);
  const res = json(compact(readJson(t, i + 8)), 200, { 'Cache-Control': 'public, max-age=45' });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

const ID = /^[\w.:-]{1,80}$/;
async function readEvent(kv, id) {
  try { return (await kv.get('u:' + id, 'json')) || {}; } catch (e) { return {}; }
}

async function attendance(request, env) {
  const kv = env.DOCHADZKA;
  if (!kv) return json({ error: 'KV úložisko DOCHADZKA nie je pripojené' }, 503);
  if (request.method === 'GET') {
    const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').filter(x => ID.test(x)).slice(0, 25);
    const out = {};
    await Promise.all(ids.map(async id => { out[id] = await readEvent(kv, id); }));
    return json(out, 200, { 'Cache-Control': 'no-store' });
  }
  if (request.method === 'POST') {
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Zlé údaje' }, 400); }
    const id = String(b.id || ''), meno = String(b.meno || '').trim().replace(/\s+/g, ' ').slice(0, 60), o = String(b.o || '');
    if (!ID.test(id) || !meno || !['ano', 'nie', ''].includes(o)) return json({ error: 'Zlé údaje' }, 400);
    const ev = await readEvent(kv, id);
    if (o) ev[meno] = { o, t: Date.now() }; else delete ev[meno];
    // záznam sa sám zmaže po 120 dňoch
    await kv.put('u:' + id, JSON.stringify(ev), { expirationTtl: 120 * 86400 });
    return json(ev, 200, { 'Cache-Control': 'no-store' });
  }
  return json({ error: 'Nepodporovaná metóda' }, 405);
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      const path = new URL(request.url).pathname.replace(/\/+$/, '');
      if (path === '/dochadzka') return await attendance(request, env);
      if (new URL(request.url).searchParams.has('zapas')) return await live(request, ctx);
      return json({ ok: true, app: 'TJ Klas Beša', dochadzka: !!env.DOCHADZKA });
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  },
};
