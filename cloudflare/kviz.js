// Kvíz partie: denný kvíz pre partiu (stránka kviz/ na GitHub Pages).
// Beží v samostatnej inštancii Durable Objectu ChatRoom (idFromName('kviz-partia')), takže má vlastnú databázu.
// Všetko sa vyhodnocuje tu na serveri: správne odpovede ani čas sa nedajú obísť z telefónu.
import POOL from './kviz-otazky.js';

const N = 12, SEC = 20, DOZADU = 3, START = '2026-11-12', SEED = 20261112, HESLO = 'partia';
const NOSTORE = { 'Cache-Control': 'no-store' };

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
const perms = {};
function dayNum(day) { return Math.max(0, Math.round((Date.parse(day + 'T12:00:00Z') - Date.parse(START + 'T12:00:00Z')) / 864e5)); }
// 12 otázok na deň; v jednom cykle sa žiadna nezopakuje (cca 135 dní), potom nové poradie
export function dennaSada(day) {
  const n = dayNum(day), all = POOL.q.length, perCycle = Math.floor(all / N), c = Math.floor(n / perCycle), st = (n % perCycle) * N;
  if (!perms[c]) perms[c] = shuffle([...Array(all).keys()], mulberry(SEED + c * 7919));
  return perms[c].slice(st, st + N).map((qi, i) => {
    const q = POOL.q[qi], opts = shuffle([q[2], ...q[3]], mulberry(SEED + n * 131 + i * 17));
    return { tema: POOL.t[q[0]], text: q[1], opts, ok: opts.indexOf(q[2]), pozn: q[4] || '' };
  });
}

export async function kviz(room, path, body, h) {
  const { json, sha, rnd, skDate, weekStart } = h;
  const sql = (s, ...a) => room.ctx.storage.sql.exec(s, ...a);
  const rows = (s, ...a) => [...sql(s, ...a)];
  const out = (o, st = 200) => json(o, st, NOSTORE);
  if (!room.kpReady) {
    sql(`CREATE TABLE IF NOT EXISTS kp_cfg (k TEXT PRIMARY KEY, v TEXT)`);
    sql(`CREATE TABLE IF NOT EXISTS kp_hraci (token TEXT PRIMARY KEY, meno TEXT UNIQUE COLLATE NOCASE, t INTEGER)`);
    sql(`CREATE TABLE IF NOT EXISTS kp_dni (token TEXT, den TEXT, i INTEGER DEFAULT 0, s INTEGER DEFAULT 0, c INTEGER DEFAULT 0, r TEXT DEFAULT '', pend INTEGER DEFAULT 0, t0 INTEGER DEFAULT 0, PRIMARY KEY (token, den))`);
    sql(`CREATE TABLE IF NOT EXISTS kp_ceny (id INTEGER PRIMARY KEY AUTOINCREMENT, tyzden TEXT, text TEXT, token TEXT, t INTEGER)`);
    sql(`CREATE TABLE IF NOT EXISTS kp_hlasy (tyzden TEXT, token TEXT, cena INTEGER, PRIMARY KEY (tyzden, token))`);
    sql(`CREATE TABLE IF NOT EXISTS kp_fails (t INTEGER)`);
    // 'hrane' = deň, kedy hráč kvíz reálne odohral (pri dohrávaní zmeškaného dňa sa líši od 'den')
    if (!rows('PRAGMA table_info(kp_dni)').some(c => c.name === 'hrane')) {
      sql('ALTER TABLE kp_dni ADD COLUMN hrane TEXT');
      sql('UPDATE kp_dni SET hrane=den WHERE hrane IS NULL');
    }
    room.kpReady = true;
  }
  const cfg = k => (rows('SELECT v FROM kp_cfg WHERE k=?', k)[0] || {}).v;
  const setCfg = (k, v) => sql('INSERT OR REPLACE INTO kp_cfg (k, v) VALUES (?, ?)', k, v);
  const now = Date.now(), den = skDate(0), tyz = weekStart(den);
  const tooMany = () => { sql('DELETE FROM kp_fails WHERE t < ?', now - 10 * 60000); return rows('SELECT COUNT(*) AS n FROM kp_fails')[0].n >= 20; };
  const fail = () => sql('INSERT INTO kp_fails (t) VALUES (?)', now);

  // ---- prihlásenie spoločným heslom + meno ----
  if (path === '/kp/login') {
    if (tooMany()) return out({ error: 'Priveľa zlých pokusov, skús o 10 minút.' }, 429);
    const heslo = String(body.heslo || '').trim(), meno = String(body.meno || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    const hash = cfg('heslo');
    const ok = hash ? (await sha('kp:' + heslo)) === hash : heslo === HESLO;
    if (!ok) { fail(); return out({ error: 'Nesprávne heslo.' }, 403); }
    if (meno.length < 2) return out({ error: 'Meno musí mať aspoň 2 znaky.' }, 400);
    const r = rows('SELECT token, meno FROM kp_hraci WHERE meno=?', meno)[0];
    if (r) return out({ token: r.token, meno: r.meno });
    const token = rnd(16);
    sql('INSERT INTO kp_hraci (token, meno, t) VALUES (?, ?, ?)', token, meno, now);
    return out({ token, meno });
  }

  // ---- správca: zmena hesla, mazanie návrhov ----
  const adminOk = async pin => {
    pin = String(pin || '');
    if (room.env.ADMIN_PIN && pin === String(room.env.ADMIN_PIN)) return true;
    const h2 = cfg('pin');
    return !!h2 && (await sha('kpa:' + pin)) === h2;
  };
  if (path === '/kp/admin') {
    if (tooMany()) return out({ error: 'Priveľa zlých pokusov, skús o 10 minút.' }, 429);
    const pin = String(body.pin || '');
    if (!cfg('pin') && !room.env.ADMIN_PIN) {
      if (pin.length < 4) return out({ error: 'Nastav si správcovský PIN (aspoň 4 znaky).' }, 400);
      setCfg('pin', await sha('kpa:' + pin));
    } else if (!(await adminOk(pin))) { fail(); return out({ error: 'Nesprávny PIN.' }, 403); }
    if (body.heslo) {
      const v = String(body.heslo).trim();
      if (v.length < 3) return out({ error: 'Heslo musí mať aspoň 3 znaky.' }, 400);
      setCfg('heslo', await sha('kp:' + v));
    }
    if (body.zmazHraca) {
      const t = rows('SELECT token FROM kp_hraci WHERE meno=?', String(body.zmazHraca))[0];
      if (t) { sql('DELETE FROM kp_dni WHERE token=?', t.token); sql('DELETE FROM kp_hlasy WHERE token=?', t.token); sql('DELETE FROM kp_hraci WHERE token=?', t.token); }
    }
    return out({ ok: true, hraci: rows('SELECT meno FROM kp_hraci ORDER BY meno').map(r => r.meno) });
  }

  // ---- všetko ostatné potrebuje prihláseného hráča ----
  const me = rows('SELECT token, meno FROM kp_hraci WHERE token=?', String(body.token || ''))[0];
  if (!me) return out({ error: 'Prihlás sa znova.', odhlasit: true }, 401);
  // Rovnaké pravidlo ako kvíz v klubovej appke: zmeškaný deň sa dá dohrať najviac 3 dni dozadu, len v aktuálnom mesiaci.
  // Body sa rátajú do pôvodného dňa.
  const dozadu = [...Array(DOZADU)].map((_, i) => skDate(-(i + 1))).filter(x => x.slice(0, 7) === den.slice(0, 7) && x >= START);
  const zDna = dd => rows('SELECT i, s, c, r, pend, t0, hrane FROM kp_dni WHERE token=? AND den=?', me.token, dd)[0] || null;
  const uzavriet = (dd, d) => {
    if (d && d.pend && now - d.t0 > (SEC + 2) * 1000) {
      sql('UPDATE kp_dni SET pend=0, r=r||? WHERE token=? AND den=?', '0', me.token, dd);
      return zDna(dd);
    }
    return d;
  };
  const zvolDen = () => {
    const dd = String(body.den || den);
    if (dd !== den && !dozadu.includes(dd)) return null;
    return dd;
  };

  if (path === '/kp/otazka') {
    const dd = zvolDen();
    if (!dd) return out({ error: 'Tento deň sa už dohrať nedá. Dohrať sa dajú najviac 3 dni dozadu v rámci mesiaca.' }, 400);
    const sada = dennaSada(dd);
    let d = uzavriet(dd, zDna(dd));
    if (!d || d.i === 0) {
      if (!d) sql('INSERT INTO kp_dni (token, den, hrane) VALUES (?, ?, ?)', me.token, dd, den);
      else sql('UPDATE kp_dni SET hrane=? WHERE token=? AND den=?', den, me.token, dd);
      d = zDna(dd);
    }
    if (!d.pend) {
      if (d.i >= N) return out({ koniec: true, den: dd, s: d.s, c: d.c, r: d.r });
      sql('UPDATE kp_dni SET i=i+1, pend=1, t0=? WHERE token=? AND den=?', now, me.token, dd);
      d = zDna(dd);
    }
    const q = sada[d.i - 1];
    return out({ den: dd, n: d.i, tema: q.tema, text: q.text, opts: q.opts, zostava: Math.max(0, SEC - (now - d.t0) / 1000), s: d.s, r: d.r });
  }

  if (path === '/kp/odpoved') {
    const dd = zvolDen();
    const d = dd && zDna(dd);
    if (!d || !d.pend) return out({ error: 'Žiadna otvorená otázka.' }, 409);
    const q = dennaSada(dd)[d.i - 1], k = Number(body.k), cas = (now - d.t0) / 1000;
    const vcas = cas <= SEC + 1.5, ok = vcas && k === q.ok;
    const body2 = ok ? 10 + Math.min(10, Math.round(Math.max(0, SEC - cas) / 2)) : 0;
    sql('UPDATE kp_dni SET pend=0, s=s+?, c=c+?, r=r||? WHERE token=? AND den=?', body2, ok ? 1 : 0, ok ? '1' : '0', me.token, dd);
    const n = zDna(dd);
    return out({ den: dd, ok, body: body2, vcas, spravna: q.ok, pozn: q.pozn, s: n.s, c: n.c, r: n.r, koniec: n.i >= N });
  }

  if (path === '/kp/navrh') {
    const text = String(body.text || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (text.length < 2) return out({ error: 'Napíš návrh.' }, 400);
    if (rows('SELECT COUNT(*) AS n FROM kp_ceny WHERE tyzden=? AND token=?', tyz, me.token)[0].n >= 3) return out({ error: 'Týždenne môžeš pridať najviac 3 návrhy.' }, 400);
    sql('INSERT INTO kp_ceny (tyzden, text, token, t) VALUES (?, ?, ?, ?)', tyz, text, me.token, now);
  }
  if (path === '/kp/hlas') {
    const id = Number(body.cena);
    if (!rows('SELECT id FROM kp_ceny WHERE id=? AND tyzden=?', id, tyz).length) return out({ error: 'Taký návrh už neexistuje.' }, 404);
    sql('INSERT OR REPLACE INTO kp_hlasy (tyzden, token, cena) VALUES (?, ?, ?)', tyz, me.token, id);
  }
  if (path === '/kp/zmaz') {
    const id = Number(body.cena), c = rows('SELECT token FROM kp_ceny WHERE id=?', id)[0];
    if (c && (c.token === me.token || await adminOk(body.pin))) { sql('DELETE FROM kp_ceny WHERE id=?', id); sql('DELETE FROM kp_hlasy WHERE cena=?', id); }
    else if (c) return out({ error: 'Zmazať môžeš len svoj návrh.' }, 403);
  }

  // ---- stav: rebríčky, ceny, dnešok ----
  const board = (od, po) => rows(`SELECT h.meno, SUM(d.s) AS body, SUM(d.c) AS spravne, SUM(length(d.r)) AS odp, COUNT(*) AS dni
      FROM kp_dni d JOIN kp_hraci h ON h.token=d.token WHERE d.den>=? AND d.den<=? AND d.i>0
      GROUP BY d.token ORDER BY body DESC, spravne DESC, h.meno`, od, po);
  const nedela = w => { const x = new Date(w + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 6); return x.toISOString().slice(0, 10); };
  const ceny = w => rows(`SELECT c.id, c.text, c.token=? AS moja, COUNT(v.token) AS hlasy FROM kp_ceny c LEFT JOIN kp_hlasy v ON v.cena=c.id
      WHERE c.tyzden=? GROUP BY c.id ORDER BY hlasy DESC, c.t`, me.token, w);
  const minTyz = weekStart(skDate(-7));
  const minB = board(minTyz, nedela(minTyz))[0] || null, minC = ceny(minTyz)[0] || null;
  const d = uzavriet(den, zDna(den));
  const zmeskane = dozadu.slice().reverse().map(x => {
    const z = uzavriet(x, zDna(x));
    return { den: x, i: z ? z.i : 0, s: z ? z.s : 0, c: z ? z.c : 0, r: z ? z.r : '' };
  }).filter(z => z.i < N);
  return out({
    meno: me.meno, den, tyzden: tyz, tyzdenDo: nedela(tyz),
    dnes: d ? { i: d.i, s: d.s, c: d.c, r: d.r, pend: !!d.pend } : null,
    temy: [...new Set(dennaSada(den).map(q => q.tema))],
    zmeskane,
    rebricek: { dnes: board(den, den), tyzden: board(tyz, nedela(tyz)), mesiac: board(den.slice(0, 7) + '-01', den.slice(0, 7) + '-31'), rok: board(den.slice(0, 4) + '-01-01', den.slice(0, 4) + '-12-31') },
    ceny: ceny(tyz).map(c => ({ id: c.id, text: c.text, hlasy: c.hlasy, moja: !!c.moja })),
    mojHlas: (rows('SELECT cena FROM kp_hlasy WHERE tyzden=? AND token=?', tyz, me.token)[0] || {}).cena || null,
    minuly: minB ? { meno: minB.meno, body: minB.body, cena: minC && minC.hlasy ? minC.text : null } : null,
  });
}
