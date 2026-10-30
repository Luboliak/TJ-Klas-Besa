// Cloudflare Worker pre appku TJ Klas Beša.
//  1) Živé zápasy: /?zapas=<odkaz na zápas na Sportnete>  -> skóre, minúta, góly, karty, zostavy, rozhodcovia
//  2) Dochádzka:   /dochadzka?ids=a,b,c  (GET)  a  POST /dochadzka {id, meno, o: "ano" | "nie" | ""}
//     Potrebuje KV úložisko pripojené pod názvom DOCHADZKA (Settings > Bindings > KV namespace).
//  3) Chat:        /chat/... (Durable Object ChatRoom, nasadzuje sa cez GitHub Actions)

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


// ------------------------------------------------------------------ CHAT
// Jedna klubová miestnosť (Durable Object so SQLite). Prístup len s klubovým PIN-om.
// PIN a správcovský PIN sa nastavia pri prvom spustení priamo z appky (/chat/setup).

const KEEP_DAYS = 60;
// Hráč zápasu: hlasuje sa od konca zápasu (výkop + 100 min) do 3 dní po zápase
const mvpWindow = start => ({ opens: start + 100 * 60000, closes: start + 105 * 60000 + 72 * 3600000 });

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');

export class ChatRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, meno TEXT, text TEXT, del INTEGER DEFAULT 0)`);
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS mvp_polls (id TEXT PRIMARY KEY, start INTEGER, title TEXT)`);
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS mvp_votes (poll TEXT, voter TEXT, za TEXT, t INTEGER, PRIMARY KEY (poll, voter))`);
      this.cfg = (await ctx.storage.get('cfg')) || null;
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS fails (t INTEGER)`);
    });
  }

  async checkPin(pin, admin) {
    if (!this.cfg) return false;
    // zlé pokusy sa ukladajú natrvalo: 15 zlých PIN-ov za 10 minút = 10 minút blokované
    const now = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM fails WHERE t < ?', now - 10 * 60000);
    if (this.rows('SELECT COUNT(*) AS n FROM fails')[0].n >= 15) return 'locked';
    // záložný správcovský PIN z Cloudflare (GitHub secret CHAT_ADMIN_PIN), keď sa pôvodný zabudne
    const envAdmin = admin && this.env.ADMIN_PIN && String(pin || '') === String(this.env.ADMIN_PIN);
    const ok = envAdmin || (await sha(this.cfg.salt + String(pin || ''))) === (admin ? this.cfg.admin : this.cfg.pin);
    if (!ok) this.ctx.storage.sql.exec('INSERT INTO fails (t) VALUES (?)', now);
    return ok;
  }

  rows(sql, ...args) { return [...this.ctx.storage.sql.exec(sql, ...args)]; }
  recent(before) {
    const r = before
      ? this.rows('SELECT id,t,meno,text FROM msgs WHERE del=0 AND id<? ORDER BY id DESC LIMIT 80', before)
      : this.rows('SELECT id,t,meno,text FROM msgs WHERE del=0 ORDER BY id DESC LIMIT 80');
    return r.reverse();
  }
  broadcast(obj) {
    const s = JSON.stringify(obj);
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(s); } catch (e) {} }
  }
  async notify(meno, text) {
    if (!this.cfg || !this.cfg.topic) return;
    try {
      await Promise.race([
        fetch('https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: this.cfg.topic, title: 'Klubový chat', message: 'Nová správa od ' + meno, tags: ['speech_balloon'] }) }),
        new Promise(r => setTimeout(r, 3000)),
      ]);
    } catch (e) {}
  }

  async fetch(request) {
    const url = new URL(request.url), path = url.pathname.replace(/\/+$/, '');
    let body = {};
    if (request.method === 'POST') { try { body = await request.json(); } catch (e) { return json({ error: 'Zlé údaje' }, 400); } }
    const pin = body.pin ?? url.searchParams.get('pin');

    if (path === '/chat/status') return json({ setup: !!this.cfg });
    if (path === '/mvp/summary') return json({ polls: this.mvpSummary() }, 200, { 'Cache-Control': 'public, max-age=300' });

    if (path === '/chat/setup' && request.method === 'POST') {
      if (this.cfg) return json({ error: 'Chat je už nastavený' }, 409);
      const p = String(body.pin || ''), a = String(body.admin || '');
      if (p.length < 4 || a.length < 4 || p === a) return json({ error: 'PIN aj správcovský PIN musia mať aspoň 4 znaky a byť rôzne' }, 400);
      const salt = rnd(16);
      this.cfg = { salt, pin: await sha(salt + p), admin: await sha(salt + a), topic: 'tjklas-chat-' + rnd(5) };
      await this.ctx.storage.put('cfg', this.cfg);
      return json({ ok: true, topic: this.cfg.topic });
    }

    if (path === '/chat/config' && request.method === 'POST') {
      const ok = await this.checkPin(body.admin, true);
      if (ok === 'locked') return json({ error: 'Príliš veľa pokusov, skús o 10 minút' }, 429);
      if (!ok) return json({ error: 'Zlý správcovský PIN' }, 403);
      if (body.newPin) {
        if (String(body.newPin).length < 4) return json({ error: 'PIN musí mať aspoň 4 znaky' }, 400);
        this.cfg.pin = await sha(this.cfg.salt + String(body.newPin));
        await this.ctx.storage.put('cfg', this.cfg);
        for (const ws of this.ctx.getWebSockets()) { try { ws.close(4001, 'PIN zmenený'); } catch (e) {} }
      }
      return json({ ok: true, topic: this.cfg.topic });
    }

    const admin = body.adminPin ? (await this.checkPin(body.adminPin, true)) === true : false;
    const ok = admin || await this.checkPin(pin, false);
    if (ok === 'locked') return json({ error: 'Príliš veľa pokusov, skús o 10 minút' }, 429);
    if (!ok) return json({ error: this.cfg ? 'Zlý PIN' : 'Chat ešte nie je nastavený' }, this.cfg ? 403 : 409);

    if (path === '/mvp/get') {
      const meno = url.searchParams.get('meno') || '';
      const ids = (url.searchParams.get('ids') || '').split(',').filter(x => ID.test(x)).slice(0, 20);
      const out = {};
      for (const id of ids) out[id] = this.mvpState(id, meno);
      return json(out, 200, { 'Cache-Control': 'no-store' });
    }
    if (path === '/mvp/vote' && request.method === 'POST') {
      const id = String(body.id || ''), meno = String(body.meno || '').trim().slice(0, 60), za = String(body.za || '').trim().slice(0, 60);
      if (!ID.test(id) || !meno) return json({ error: 'Zlé údaje' }, 400);
      if (za && za === meno) return json({ error: 'Za seba hlasovať nemôžeš' }, 400);
      let poll = this.rows('SELECT start FROM mvp_polls WHERE id=?', id)[0];
      if (!poll) {
        const st = Number(body.start) || 0;
        if (Math.abs(st - Date.now()) > 10 * 86400000) return json({ error: 'Zlý čas zápasu' }, 400);
        poll = { start: st, nova: true };
      }
      const w = mvpWindow(poll.start), now = Date.now();
      if (now < w.opens) return json({ error: 'Hlasovanie sa otvorí po zápase' }, 400);
      if (now > w.closes) return json({ error: 'Hlasovanie už skončilo' }, 400);
      if (poll.nova) this.ctx.storage.sql.exec('INSERT INTO mvp_polls (id, start, title) VALUES (?, ?, ?)', id, poll.start, String(body.title || '').slice(0, 120));
      if (za) this.ctx.storage.sql.exec('INSERT OR REPLACE INTO mvp_votes (poll, voter, za, t) VALUES (?, ?, ?, ?)', id, meno, za, now);
      else this.ctx.storage.sql.exec('DELETE FROM mvp_votes WHERE poll=? AND voter=?', id, meno);
      return json(this.mvpState(id, meno));
    }

    if (path === '/chat/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Treba WebSocket' }, 426);
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (path === '/chat/history') {
      const before = parseInt(url.searchParams.get('before') || '0') || 0;
      return json({ msgs: this.recent(before), topic: this.cfg.topic, admin }, 200, { 'Cache-Control': 'no-store' });
    }
    if (path === '/chat/send' && request.method === 'POST') {
      const meno = String(body.meno || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      const text = String(body.text || '').replace(/\r/g, '').trim().slice(0, 1000);
      if (!meno || !text) return json({ error: 'Chýba meno alebo text' }, 400);
      const t = Date.now();
      const row = this.rows('INSERT INTO msgs (t, meno, text) VALUES (?, ?, ?) RETURNING id', t, meno, text)[0];
      this.ctx.storage.sql.exec('DELETE FROM msgs WHERE t < ?', t - KEEP_DAYS * 86400000);
      const m = { id: row.id, t, meno, text, cid: body.cid || null };
      this.broadcast({ type: 'msg', m });
      await this.notify(meno, text);
      return json({ ok: true, m });
    }
    if (path === '/chat/delete' && request.method === 'POST') {
      const id = parseInt(body.id) || 0;
      const r = this.rows('SELECT meno FROM msgs WHERE id=?', id)[0];
      if (!r) return json({ error: 'Správa neexistuje' }, 404);
      if (!admin && r.meno !== String(body.meno || '')) return json({ error: 'Zmazať môže len autor alebo správca' }, 403);
      this.ctx.storage.sql.exec('UPDATE msgs SET del=1, text=\'\' WHERE id=?', id);
      this.broadcast({ type: 'del', id });
      return json({ ok: true });
    }
    return json({ error: 'Neznáma adresa' }, 404);
  }

  mvpState(id, meno) {
    const poll = this.rows('SELECT start FROM mvp_polls WHERE id=?', id)[0];
    if (!poll) return { exists: false };
    const w = mvpWindow(poll.start), now = Date.now();
    const n = this.rows('SELECT COUNT(*) AS n FROM mvp_votes WHERE poll=?', id)[0].n;
    const mine = (this.rows('SELECT za FROM mvp_votes WHERE poll=? AND voter=?', id, meno)[0] || {}).za || '';
    const st = { exists: true, opens: w.opens, closes: w.closes, open: now >= w.opens && now <= w.closes, n, mine };
    if (now > w.closes) st.results = this.rows('SELECT za, COUNT(*) AS c FROM mvp_votes WHERE poll=? GROUP BY za ORDER BY c DESC, za', id).map(r => [r.za, r.c]);
    return st;
  }
  mvpSummary() {
    const now = Date.now(), out = [];
    for (const p of this.rows('SELECT id, start, title FROM mvp_polls ORDER BY start')) {
      const w = mvpWindow(p.start);
      if (now <= w.closes) continue;
      const res = this.rows('SELECT za, COUNT(*) AS c FROM mvp_votes WHERE poll=? GROUP BY za ORDER BY c DESC, za', p.id).map(r => [r.za, r.c]);
      if (!res.length) continue;
      out.push({ id: p.id, title: p.title, closes: w.closes, n: res.reduce((a, r) => a + r[1], 0), winners: res.filter(r => r[1] === res[0][1]).map(r => r[0]), top: res.slice(0, 5) });
    }
    return out;
  }

  webSocketMessage(ws, msg) { if (msg === 'ping') { try { ws.send('pong'); } catch (e) {} } }
  webSocketClose(ws) { try { ws.close(); } catch (e) {} }
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      const path = new URL(request.url).pathname.replace(/\/+$/, '');
      if (path === '/dochadzka') return await attendance(request, env);
      if (path.startsWith('/chat/') || path.startsWith('/mvp/')) {
        if (!env.CHAT) return json({ error: 'Chat nie je nasadený' }, 503);
        return await env.CHAT.get(env.CHAT.idFromName('klub')).fetch(request);
      }
      if (new URL(request.url).searchParams.has('zapas')) return await live(request, ctx);
      return json({ ok: true, app: 'TJ Klas Beša', dochadzka: !!env.DOCHADZKA, chat: !!env.CHAT });
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  },
};
