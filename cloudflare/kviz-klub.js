// Klubový kvíz TJ Klas Beša: 12 otázok denne, každý hráč má vlastnú sadu (nikto v ten deň nemá rovnakú otázku), všetko sa vyhodnocuje tu na serveri
// (správne odpovede ani čas sa nedajú obísť z telefónu, lebo víťaz mesiaca dostane bonus k výplate).
// Meno hráča určuje server podľa osobného hesla (alebo správca v apke s klubovým PIN-om).
import POOL from './kviz-klub-otazky.js';

const N = 12, SEC = 20;
const NOSTORE = { 'Cache-Control': 'no-store' };
// zloženie dennej sady: 4 ľahšie, 3 stredné, 3 ťažké otázky z banky + 2 príklady (počty a logika) – rovnaká obťažnosť pre všetkých
const SKLAD = [1, 1, 1, 1, 2, 2, 'm2', 2, 3, 3, 'm3', 3];

const rnd = n => Math.floor(Math.random() * n);
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = rnd(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
const fmt = n => { const s = String(n), neg = s.startsWith('-'), [i, d] = s.replace('-', '').split('.'); return (neg ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? ',' + d : ''); };
const LV = [[], [], []]; POOL.q.forEach((q, i) => LV[(q[5] || 1) - 1].push(i));

// príklady sa generujú pre každého hráča zvlášť, takže si ich nemôžu prezradiť
export function priklad(t) {
  const r = (a, b) => a + rnd(b - a + 1), ch = a => a[rnd(a.length)];
  let q, ok, z = [], e = '';
  const near = (x, ds) => ds.map(d => x + d).filter(v => v !== x && v > 0);
  const typy2 = ['perc', 'mul', 'div', 'poradie', 'priemer', 'cas'], typy3 = ['mul2', 'zdraz', 'zlava', 'rovnica', 'rychlost', 'postup', 'stvorec'];
  const typ = ch(t === 'm2' ? typy2 : typy3);
  if (typ === 'perc') { const p = ch([5, 10, 15, 20, 25, 30, 40, 60, 75]), b = r(2, 30) * 20; ok = b * p / 100; q = `Koľko je ${p} % z ${fmt(b)}?`; z = near(ok, [b / 10, -b / 20, ok, b * 5 / 100].map(Math.round)); e = `${p} % z ${fmt(b)} = ${fmt(b)} × ${p} / 100 = ${fmt(ok)}.`; }
  if (typ === 'mul') { const a = r(13, 89), b = r(3, 9); ok = a * b; q = `Koľko je ${a} × ${b}?`; z = near(ok, [b, -b, 10, -10, a]); e = `${a} × ${b} = ${fmt(ok)}.`; }
  if (typ === 'div') { const b = r(3, 9), c = r(12, 45), a = b * c; ok = c; q = `Koľko je ${fmt(a)} : ${b}?`; z = near(ok, [1, -1, 2, -2, 10]); e = `${b} × ${c} = ${fmt(a)}.`; }
  if (typ === 'poradie') { const a = r(2, 20), b = r(2, 9), c = r(2, 9); ok = a + b * c; q = `Koľko je ${a} + ${b} × ${c}?`; z = [(a + b) * c, ...near(ok, [b, -c, 1])]; e = `Najprv násobenie: ${b} × ${c} = ${b * c}, potom + ${a}.`; }
  if (typ === 'priemer') { const k = r(10, 40), x = r(1, 9), y = r(1, 9); const v = [k - x, k + y, k + x - y]; ok = k; q = `Aký je priemer čísel ${v.join(', ')}?`; z = near(ok, [1, -1, 2, -2, 3]); e = `Súčet ${v.reduce((s, n) => s + n, 0)} / 3 = ${k}.`; }
  if (typ === 'cas') { const h = r(1, 5), m = ch([10, 15, 20, 25, 35, 40, 45, 50]); ok = h * 60 + m; q = `Koľko minút je ${h} h ${m} min?`; z = near(ok, [-60, 60, 10, -10, h * 100 + m - ok]); e = `${h} × 60 + ${m} = ${ok}.`; }
  if (typ === 'mul2') { const a = r(12, 39), b = r(12, 29); ok = a * b; q = `Koľko je ${a} × ${b}?`; z = near(ok, [a, -a, b, 10, -10, 100]); e = `${a} × ${b} = ${fmt(ok)}.`; }
  if (typ === 'zdraz') { const p = ch([10, 20, 25, 50]), b = r(2, 30) * 20; ok = b + b * p / 100; q = `Tovar stál ${fmt(b)} €. Zdražel o ${p} %. Koľko stojí teraz?`; z = near(ok, [-b * p / 200, b * p / 200, p, -p].map(Math.round)); e = `${fmt(b)} + ${p} % (${fmt(b * p / 100)}) = ${fmt(ok)} €.`; ok = fmt(ok) + ' €'; z = z.map(v => fmt(v) + ' €'); }
  if (typ === 'zlava') { const p = ch([10, 20, 25, 30, 40, 50]), b = r(2, 30) * 10; ok = b - b * p / 100; q = `Bunda stojí ${fmt(b)} €, dostaneš zľavu ${p} %. Koľko zaplatíš?`; z = near(ok, [-p, p, b * p / 100 - ok, 5].map(Math.round)); e = `${p} % z ${fmt(b)} je ${fmt(b * p / 100)}, ${fmt(b)} − ${fmt(b * p / 100)} = ${fmt(ok)} €.`; ok = fmt(ok) + ' €'; z = z.map(v => fmt(v) + ' €'); }
  if (typ === 'rovnica') { const a = r(2, 9), x = r(2, 15), b = r(1, 30), c = a * x + b; ok = x; q = `Aké x platí v rovnici ${a}x + ${b} = ${c}?`; z = near(ok, [1, -1, 2, b]); e = `${a}x = ${c} − ${b} = ${c - b}, x = ${x}.`; }
  if (typ === 'rychlost') { const v = ch([40, 50, 60, 80, 90, 100, 120]), mins = ch([15, 30, 45, 90, 120, 150]), d = v * mins / 60; if (d % 1) return priklad(t); ok = mins; q = `Auto ide stálou rýchlosťou ${v} km/h. Za koľko minút prejde ${fmt(d)} km?`; z = near(ok, [15, -15, 30, 10]); e = `${fmt(d)} / ${v} h = ${mins} min.`; ok = ok + ' min'; z = z.map(x => x + ' min'); }
  if (typ === 'postup') { if (rnd(2)) { const a = r(2, 20), k = r(3, 12); const s = [0, 1, 2, 3].map(i => a + i * k); ok = a + 4 * k; q = `Ktoré číslo nasleduje: ${s.join(', ')}, …?`; z = near(ok, [k, -1, 1, -k + 1]); e = `Každé číslo je o ${k} väčšie.`; } else { const a = r(2, 5), k = ch([2, 3]); const s = [0, 1, 2, 3].map(i => a * k ** i); ok = a * k ** 4; q = `Ktoré číslo nasleduje: ${s.join(', ')}, …?`; z = near(ok, [-s[3], s[3], 2, -a]); e = `Každé číslo je ${k}-krát väčšie.`; } }
  if (typ === 'stvorec') { const a = r(13, 29); ok = a * a; q = `Koľko je ${a}²?`; z = near(ok, [a, -a, 2 * a, 10]); e = `${a} × ${a} = ${fmt(ok)}.`; }
  ok = typeof ok === 'number' ? fmt(ok) : ok;
  const zz = [...new Set(z.map(v => typeof v === 'number' ? fmt(v) : v))].filter(v => v !== ok);
  while (zz.length < 3) { const v = typeof ok === 'string' && /€|min/.test(ok) ? null : fmt(Number(String(ok).replace(/\s/g, '').replace(',', '.')) + r(2, 9) * (zz.length + 1)); if (v && !zz.includes(v) && v !== ok) zz.push(v); else if (!v) return priklad(t); }
  const opts = shuffle([ok, ...shuffle(zz).slice(0, 3)]);
  return { tema: 'Počty a logika', text: q, opts, ok: opts.indexOf(ok), pozn: e };
}

function poOtazku(item) {
  if (item.m) return item.m;
  const q = POOL.q[item.q], all = [q[2], ...q[3]], opts = item.o.map(i => all[i]);
  return { tema: POOL.t[q[0]], text: q[1], opts, ok: opts.indexOf(q[2]), pozn: q[4] || '' };
}

// nová osobná sada: v ten istý deň nikto iný nemá rovnakú otázku a hráč nedostane otázku, ktorú už mal
function novaSada(rows, sql, meno, den) {
  const used = new Set();
  for (const r of rows('SELECT sada FROM kq_dni WHERE den=? AND meno<>?', den, meno)) { try { for (const it of JSON.parse(r.sada || '[]')) if (it.q != null) used.add(it.q); } catch (e) {} }
  const seen = new Set(rows('SELECT qi FROM kq_seen WHERE meno=?', meno).map(r => r.qi)), mine = new Set(), temy = {};
  const vyber = lv => {
    const L = LV[lv - 1];
    // najprv otázky z tém, ktoré v sade ešte nie sú (najviac 2 z jednej témy)
    for (const ok of [i => !used.has(i) && !seen.has(i) && !temy[POOL.q[i][0]], i => !used.has(i) && !seen.has(i) && (temy[POOL.q[i][0]] || 0) < 2, i => !used.has(i), () => true]) {
      const c = L.filter(i => !mine.has(i) && ok(i));
      if (c.length) { const i = c[rnd(c.length)]; mine.add(i); temy[POOL.q[i][0]] = (temy[POOL.q[i][0]] || 0) + 1; return i; }
    }
    return L[rnd(L.length)];
  };
  const sada = SKLAD.map(s => typeof s === 'string' ? { m: priklad(s) } : { q: vyber(s), o: shuffle([0, 1, 2, 3]) });
  // keď hráč prejde celú banku danej obťažnosti, začne odznova
  for (let lv = 1; lv <= 3; lv++) if (LV[lv - 1].every(i => seen.has(i) || mine.has(i))) sql(`DELETE FROM kq_seen WHERE meno=? AND qi IN (${LV[lv - 1].join(',')})`, meno);
  for (const i of mine) sql('INSERT OR REPLACE INTO kq_seen (meno, qi, den) VALUES (?, ?, ?)', meno, i, den);
  return sada;
}

export function kqInit(sql) {
  sql(`CREATE TABLE IF NOT EXISTS kq_dni (meno TEXT, den TEXT, i INTEGER DEFAULT 0, s INTEGER DEFAULT 0, c INTEGER DEFAULT 0, r TEXT DEFAULT '', pend INTEGER DEFAULT 0, t0 INTEGER DEFAULT 0, PRIMARY KEY (meno, den))`);
  try { sql(`ALTER TABLE kq_dni ADD COLUMN sada TEXT DEFAULT ''`); } catch (e) {}
  sql(`CREATE TABLE IF NOT EXISTS kq_seen (meno TEXT, qi INTEGER, den TEXT, PRIMARY KEY (meno, qi))`);
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
  const now = Date.now(), den = skDate(0);
  const dnes = () => rows('SELECT i, s, c, r, pend, t0, sada FROM kq_dni WHERE meno=? AND den=?', meno, den)[0] || null;
  const sada = d => { let S = []; try { S = JSON.parse(d.sada || '[]'); } catch (e) {} if (S.length < N) { S = novaSada(rows, sql, meno, den); sql('UPDATE kq_dni SET sada=? WHERE meno=? AND den=?', JSON.stringify(S), meno, den); } return S; };
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
    const q = poOtazku(sada(d)[d.i - 1]);
    return out({ n: d.i, z: N, tema: q.tema, text: q.text, opts: q.opts, zostava: Math.max(0, SEC - (now - d.t0) / 1000), s: d.s, r: d.r });
  }

  if (path === '/hra/kq/odpoved') {
    const d = dnes();
    if (!d || !d.pend) return out({ error: 'Žiadna otvorená otázka.' }, 409);
    const q = poOtazku(sada(d)[d.i - 1]), k = Number(body.k), cas = (now - d.t0) / 1000;
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
