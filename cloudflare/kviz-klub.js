// Klubový kvíz TJ Klas Beša: 12 otázok denne, všetko sa vyhodnocuje tu na serveri
// (správne odpovede ani čas sa nedajú obísť z telefónu, lebo víťaz mesiaca dostane bonus k výplate).
// Meno hráča určuje server podľa osobného hesla (alebo správca v apke s klubovým PIN-om).
import POOL from './kviz-klub-otazky.js';

const N = 12, SEC = 20, START = '2026-11-14', SEED = 77104813;
const NOSTORE = { 'Cache-Control': 'no-store' };

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
const perms = {};
function dayNum(day) { return Math.max(0, Math.round((Date.parse(day + 'T12:00:00Z') - Date.parse(START + 'T12:00:00Z')) / 864e5)); }
// 12 otázok na deň; v jednom cykle (cca 148 dní) sa žiadna nezopakuje, potom nové poradie
function dennaSada(day) {
  const n = dayNum(day), all = POOL.q.length, perCycle = Math.floor(all / N), c = Math.floor(n / perCycle), st = (n % perCycle) * N;
  if (!perms[c]) perms[c] = shuffle([...Array(all).keys()], mulberry(SEED + c * 7919));
  return perms[c].slice(st, st + N).map((qi, i) => {
    const q = POOL.q[qi], opts = shuffle([q[2], ...q[3]], mulberry(SEED + n * 131 + i * 17));
    return { tema: POOL.t[q[0]], text: q[1], opts, ok: opts.indexOf(q[2]), pozn: q[4] || '' };
  });
}

export function kqInit(sql) {
  sql(`CREATE TABLE IF NOT EXISTS kq_dni (meno TEXT, den TEXT, i INTEGER DEFAULT 0, s INTEGER DEFAULT 0, c INTEGER DEFAULT 0, r TEXT DEFAULT '', pend INTEGER DEFAULT 0, t0 INTEGER DEFAULT 0, PRIMARY KEY (meno, den))`);
}

// poradie za obdobie (od – do vrátane)
export function kqBoard(rows, od, po) {
  return rows(`SELECT meno, SUM(s) AS body, SUM(c) AS spravne, COUNT(*) AS dni FROM kq_dni
    WHERE den>=? AND den<=? AND i>0 GROUP BY meno ORDER BY body DESC, spravne DESC, meno`, od, po);
}

export function klubKviz(room, path, body, meno, skDate) {
  const sql = (s, ...a) => room.ctx.storage.sql.exec(s, ...a);
  const rows = (s, ...a) => [...sql(s, ...a)];
  const out = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', ...NOSTORE } });
  if (!meno) return out({ error: 'Chýba meno' }, 400);
  const now = Date.now(), den = skDate(0), sada = dennaSada(den);
  const dnes = () => rows('SELECT i, s, c, r, pend, t0 FROM kq_dni WHERE meno=? AND den=?', meno, den)[0] || null;
  const uzavriet = d => {
    if (d && d.pend && now - d.t0 > (SEC + 2) * 1000) {
      sql('UPDATE kq_dni SET pend=0, r=r||? WHERE meno=? AND den=?', '0', meno, den);
      return dnes();
    }
    return d;
  };

  if (path === '/hra/kq/otazka') {
    let d = uzavriet(dnes());
    if (!d) { sql('INSERT INTO kq_dni (meno, den) VALUES (?, ?)', meno, den); d = dnes(); }
    if (!d.pend) {
      if (d.i >= N) return out({ koniec: true, s: d.s, c: d.c, r: d.r });
      sql('UPDATE kq_dni SET i=i+1, pend=1, t0=? WHERE meno=? AND den=?', now, meno, den);
      d = dnes();
    }
    const q = sada[d.i - 1];
    return out({ n: d.i, z: N, tema: q.tema, text: q.text, opts: q.opts, zostava: Math.max(0, SEC - (now - d.t0) / 1000), s: d.s, r: d.r });
  }

  if (path === '/hra/kq/odpoved') {
    const d = dnes();
    if (!d || !d.pend) return out({ error: 'Žiadna otvorená otázka.' }, 409);
    const q = sada[d.i - 1], k = Number(body.k), cas = (now - d.t0) / 1000;
    const vcas = cas <= SEC + 1.5, ok = vcas && k === q.ok;
    const b = ok ? 10 + Math.min(10, Math.round(Math.max(0, SEC - cas) / 2)) : 0;
    sql('UPDATE kq_dni SET pend=0, s=s+?, c=c+?, r=r||? WHERE meno=? AND den=?', b, ok ? 1 : 0, ok ? '1' : '0', meno, den);
    const n = dnes();
    return out({ ok, body: b, vcas, spravna: q.ok, pozn: q.pozn, s: n.s, c: n.c, r: n.r, koniec: n.i >= N });
  }

  // stav: dnešok + rebríčky
  const d = uzavriet(dnes()), m = den.slice(0, 7), y = den.slice(0, 4);
  const pm = new Date(Date.UTC(+y, +den.slice(5, 7) - 2, 15)).toISOString().slice(0, 7);
  return out({
    meno, den, n: N, sec: SEC,
    dnes: d ? { i: d.i, s: d.s, c: d.c, r: d.r, pend: !!d.pend } : null,
    rebricek: { dnes: kqBoard(rows, den, den), mesiac: kqBoard(rows, m + '-01', m + '-31'), rok: kqBoard(rows, y + '-01-01', y + '-12-31') },
    minulyMesiac: { m: pm, top: kqBoard(rows, pm + '-01', pm + '-31').slice(0, 3) },
  });
}
