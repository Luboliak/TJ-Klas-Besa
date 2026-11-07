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
// Tipovačka: zápasy domácej ligy sa berú zo zverejnených údajov appky (kvôli zámku po výkope a vyhodnoteniu)
const DATA_URL = 'https://luboliak.github.io/TJ-Klas-Besa/data/ligy.json';
const kickoff = m => (m.date && m.time) ? Date.parse(m.date + 'T' + m.time + ':00+01:00') - (isSummer(m.date) ? 3600000 : 0) : null;
function isSummer(d) { // letný čas v SR: posledná nedeľa marca až posledná nedeľa októbra
  const y = +d.slice(0, 4), lastSun = mo => { const x = new Date(Date.UTC(y, mo + 1, 0)); return x.getUTCDate() - x.getUTCDay(); };
  const md = d.slice(5);
  const s = '03-' + String(lastSun(2)).padStart(2, '0'), e = '10-' + String(lastSun(9)).padStart(2, '0');
  return md >= s && md < e;
}
function tipPoints(t, m) {
  if (m.hs == null) return null;
  if (t.h === m.hs && t.a === m.as) return 3;
  return Math.sign(t.h - t.a) === Math.sign(m.hs - m.as) ? 1 : 0;
}
const US = 'TJ Klas Beša';
const TIP_STRELEC = 2;   // body navyše za správne tipnutého strelca Beše
const FAN_N = 5, FAN_MAX_TEAM = 3, KVIZ_MAX = 1000;
function tipTotal(t, m, strelci) {
  const b = tipPoints(t, m);
  if (b == null) return null;
  const s = strelci[m.id];
  return b + (t.s && s && s.includes(t.s) ? TIP_STRELEC : 0);
}
function fanPoints(picks, cap, pts) { return picks.reduce((a, k) => a + (pts[k] || 0) * (k === cap ? 2 : 1), 0); }
function skDate(off) {
  const d = new Date(Date.now() + off * 86400000);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(d);
}
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
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS tips (meno TEXT, mid TEXT, h INTEGER, a INTEGER, t INTEGER, PRIMARY KEY (meno, mid))`);
      try { ctx.storage.sql.exec(`ALTER TABLE tips ADD COLUMN s TEXT`); } catch (e) {}
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS hry (meno TEXT, hra TEXT, k TEXT, score INTEGER, t INTEGER, PRIMARY KEY (meno, hra, k))`);
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS fantasy (meno TEXT, kolo TEXT, picks TEXT, cap TEXT, t INTEGER, PRIMARY KEY (meno, kolo))`);
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
    if (path === '/tip/board') return json(await this.tipBoard(), 200, { 'Cache-Control': 'public, max-age=120' });
    if (path === '/fan/board') return json(await this.fanBoard(), 200, { 'Cache-Control': 'public, max-age=120' });
    if (path === '/hra/board') return json(this.hraBoard(url.searchParams.get('hra') || ''), 200, { 'Cache-Control': 'public, max-age=60' });
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

    if (path === '/tip/mine') {
      const meno = url.searchParams.get('meno') || '';
      const tips = {};
      for (const r of this.rows('SELECT mid, h, a, s FROM tips WHERE meno=?', meno)) tips[r.mid] = r.s ? [r.h, r.a, r.s] : [r.h, r.a];
      return json({ tips }, 200, { 'Cache-Control': 'no-store' });
    }
    if (path === '/tip/match') {
      // tipy všetkých na jeden zápas, až po výkope
      const mid = url.searchParams.get('mid') || '';
      const m = (await this.tipMatches()).get(mid);
      if (!m) return json({ error: 'Zápas sa nenašiel' }, 404);
      if (Date.now() < kickoff(m)) return json({ hidden: true, n: this.rows('SELECT COUNT(*) AS n FROM tips WHERE mid=?', mid)[0].n });
      const st = (await this.body()).strelci || {};
      const all = this.rows('SELECT meno, h, a, s FROM tips WHERE mid=? ORDER BY meno', mid).map(r => ({ meno: r.meno, h: r.h, a: r.a, s: r.s || '', b: tipTotal(r, m, st) }));
      return json({ tips: all }, 200, { 'Cache-Control': 'no-store' });
    }
    if (path === '/tip/save' && request.method === 'POST') {
      const meno = String(body.meno || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (!meno || typeof body.tips !== 'object') return json({ error: 'Zlé údaje' }, 400);
      const ms = await this.tipMatches(), now = Date.now(), saved = {}, late = [];
      for (const [mid, v] of Object.entries(body.tips).slice(0, 30)) {
        const m = ms.get(mid);
        if (!m || m.hs != null) continue;
        const k = kickoff(m);
        if (!k || now >= k) { late.push(mid); continue; }
        if (v === null) { this.ctx.storage.sql.exec('DELETE FROM tips WHERE meno=? AND mid=?', meno, mid); saved[mid] = null; continue; }
        const h = parseInt(v[0]), a = parseInt(v[1]);
        if (!(h >= 0 && h <= 20 && a >= 0 && a <= 20)) continue;
        const us = m.home === US || m.away === US;
        const s = us && v[2] ? String(v[2]).trim().slice(0, 60) : null;
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO tips (meno, mid, h, a, t, s) VALUES (?, ?, ?, ?, ?, ?)', meno, mid, h, a, now, s);
        saved[mid] = s ? [h, a, s] : [h, a];
      }
      return json({ saved, late });
    }
    if (path === '/fan/mine') {
      const meno = url.searchParams.get('meno') || '', out = {};
      for (const r of this.rows('SELECT kolo, picks, cap FROM fantasy WHERE meno=?', meno)) out[r.kolo] = { picks: JSON.parse(r.picks), cap: r.cap };
      return json({ kola: out }, 200, { 'Cache-Control': 'no-store' });
    }
    if (path === '/fan/kolo') {
      // zostavy všetkých na jedno kolo, až keď sa kolo začalo
      const kolo = url.searchParams.get('kolo') || '';
      const lock = await this.roundLock(kolo);
      if (lock && Date.now() < lock) return json({ hidden: true, n: this.rows('SELECT COUNT(*) AS n FROM fantasy WHERE kolo=?', kolo)[0].n });
      const pts = ((await this.body()).fantasy || {})[kolo] || {};
      const all = this.rows('SELECT meno, picks, cap FROM fantasy WHERE kolo=? ORDER BY meno', kolo).map(r => {
        const picks = JSON.parse(r.picks);
        return { meno: r.meno, cap: r.cap, picks: picks.map(k => [k, pts[k] ?? null]), b: fanPoints(picks, r.cap, pts) };
      });
      return json({ zostavy: all }, 200, { 'Cache-Control': 'no-store' });
    }
    if (path === '/fan/save' && request.method === 'POST') {
      const meno = String(body.meno || '').trim().replace(/\s+/g, ' ').slice(0, 60), kolo = String(body.kolo || '');
      const picks = Array.isArray(body.picks) ? [...new Set(body.picks.map(x => String(x).slice(0, 100)))] : [];
      if (!meno || !kolo || picks.length !== FAN_N || !picks.includes(body.cap)) return json({ error: 'Vyber ' + FAN_N + ' hráčov a kapitána' }, 400);
      const ms = [...(await this.tipMatches()).values()], teams = new Set(ms.flatMap(m => [m.home, m.away]));
      const per = {};
      for (const k of picks) { const t = k.split('|')[1]; if (!teams.has(t)) return json({ error: 'Neznámy tím' }, 400); per[t] = (per[t] || 0) + 1; }
      if (Object.values(per).some(c => c > FAN_MAX_TEAM)) return json({ error: 'Najviac ' + FAN_MAX_TEAM + ' hráči z jedného tímu' }, 400);
      const lock = await this.roundLock(kolo);
      if (!lock || Date.now() >= lock) return json({ error: 'Kolo sa už začalo' }, 409);
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO fantasy (meno, kolo, picks, cap, t) VALUES (?, ?, ?, ?, ?)', meno, kolo, JSON.stringify(picks), body.cap, Date.now());
      return json({ ok: true });
    }
    if (path === '/hra/save' && request.method === 'POST') {
      const meno = String(body.meno || '').trim().replace(/\s+/g, ' ').slice(0, 60), hra = String(body.hra || ''), score = parseInt(body.score);
      if (!meno || !(score >= 0)) return json({ error: 'Zlé údaje' }, 400);
      if (hra === 'kviz') {
        const k = String(body.k || ''), today = skDate(0), yday = skDate(-1);
        if (k !== today && k !== yday) return json({ error: 'Kvíz už neplatí' }, 409);
        if (score > KVIZ_MAX) return json({ error: 'Zlé skóre' }, 400);
        const had = this.rows('SELECT score FROM hry WHERE meno=? AND hra=? AND k=?', meno, hra, k)[0];
        if (had) return json({ ok: true, prvy: false, score: had.score });
        this.ctx.storage.sql.exec('INSERT INTO hry (meno, hra, k, score, t) VALUES (?, ?, ?, ?, ?)', meno, hra, k, score, Date.now());
        return json({ ok: true, prvy: true, score });
      }
      if (hra === 'pk') {
        if (score > 300) return json({ error: 'Zlé skóre' }, 400);
        this.ctx.storage.sql.exec(`INSERT INTO hry (meno, hra, k, score, t) VALUES (?, 'pk', 'best', ?, ?)
          ON CONFLICT (meno, hra, k) DO UPDATE SET score = excluded.score, t = excluded.t WHERE excluded.score > hry.score`, meno, score, Date.now());
        const best = this.rows(`SELECT score FROM hry WHERE meno=? AND hra='pk' AND k='best'`, meno)[0].score;
        return json({ ok: true, best });
      }
      return json({ error: 'Neznáma hra' }, 400);
    }
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

  async tipMatches() {
    if (!this.tipCache || Date.now() - this.tipCache.at > 5 * 60000) {
      try {
        const r = await fetch((this.env.DATA_URL || DATA_URL) + '?t=' + Date.now(), { cf: { cacheTtl: 60 } });
        const j = await r.json();
        const home = (j.ligy || []).find(l => l.home);
        this.tipCache = { at: Date.now(), map: new Map((home ? home.matches : []).map(m => [m.id, m])) };
      } catch (e) {
        if (!this.tipCache) this.tipCache = { at: 0, map: new Map() };
      }
    }
    return this.tipCache.map;
  }
  async tipBoard() {
    const ms = await this.tipMatches(), pl = {};
    const st = (await this.body()).strelci || {};
    for (const r of this.rows('SELECT meno, mid, h, a, s FROM tips')) {
      const m = ms.get(r.mid);
      const p = pl[r.meno] || (pl[r.meno] = { meno: r.meno, b: 0, presne: 0, vitaz: 0, strelec: 0, tipy: 0, kola: {} });
      if (!m || m.hs == null) continue;
      const t = tipPoints(r, m), b = tipTotal(r, m, st);
      p.tipy++; p.b += b; if (t === 3) p.presne++; else if (t === 1) p.vitaz++;
      if (b > t) p.strelec++;
      if (m.round != null) p.kola[m.round] = (p.kola[m.round] || 0) + b;
    }
    const board = Object.values(pl).sort((a, b) => b.b - a.b || b.presne - a.presne || a.meno.localeCompare(b.meno, 'sk'));
    return { board, at: Date.now() };
  }

  async body() {
    // body do hier z data/hry_body.json (počíta doplnky.py zo zápisov o stretnutí)
    if (!this.bodyCache || Date.now() - this.bodyCache.at > 5 * 60000) {
      try {
        const r = await fetch((this.env.DATA_URL || DATA_URL).replace('ligy.json', 'hry_body.json') + '?t=' + Date.now(), { cf: { cacheTtl: 60 } });
        this.bodyCache = { at: Date.now(), d: r.ok ? await r.json() : {} };
      } catch (e) { if (!this.bodyCache) this.bodyCache = { at: 0, d: {} }; }
    }
    return this.bodyCache.d;
  }
  async roundLock(kolo) {
    // kolo sa zamkne výkopom prvého zápasu kola
    const ks = [...(await this.tipMatches()).values()].filter(m => String(m.round) === String(kolo)).map(kickoff).filter(Boolean);
    return ks.length ? Math.min(...ks) : null;
  }
  async fanBoard() {
    const B = await this.body(), F = B.fantasy || {}, pl = {};
    for (const r of this.rows('SELECT meno, kolo, picks, cap FROM fantasy')) {
      const pts = F[r.kolo];
      const p = pl[r.meno] || (pl[r.meno] = { meno: r.meno, b: 0, kola: {} });
      if (!pts) continue;
      const b = fanPoints(JSON.parse(r.picks), r.cap, pts);
      p.b += b; p.kola[r.kolo] = b;
    }
    return { board: Object.values(pl).sort((a, b) => b.b - a.b || a.meno.localeCompare(b.meno, 'sk')), hotove: B.kola_hotove || [], at: Date.now() };
  }
  hraBoard(hra) {
    if (hra === 'kviz') {
      const today = skDate(0);
      return {
        dnes: this.rows(`SELECT meno, score FROM hry WHERE hra='kviz' AND k=? ORDER BY score DESC, t LIMIT 50`, today),
        spolu: this.rows(`SELECT meno, SUM(score) AS score, COUNT(*) AS dni FROM hry WHERE hra='kviz' GROUP BY meno ORDER BY score DESC LIMIT 50`),
        den: today,
      };
    }
    if (hra === 'pk') return { best: this.rows(`SELECT meno, score, t FROM hry WHERE hra='pk' AND k='best' ORDER BY score DESC, t LIMIT 50`) };
    return {};
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
      if (path.startsWith('/chat/') || path.startsWith('/mvp/') || path.startsWith('/tip/') || path.startsWith('/fan/') || path.startsWith('/hra/')) {
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
