// Beša manažér: každý hráč klubu má fiktívny tím, ligu všetkých tímov simuluje server.
// Kolá sa hrajú každý deň o 20:00 (dopočítajú sa pri prvej požiadavke po tomto čase).
// Tréningové body (TB) za skutočné tréningy (podľa dochádzky vedenia), kredity za body z kvízu a za zápasy.

const LIGA_START = '2026-12-01', LIVE_MIN = 15, VYZVA_MIN = 5; // kolo sa „hrá“ naživo 15 minút od 20:00 (1 min = 6 herných minút)
// // prvá sezóna; body z kvízu sa rátajú až odtiaľto
const MIN_KOL = 30, KOLO_HOD = 20, TB_TRENING = 3, TB_KOLO = 1, START_KREDIT = 1000, MAX_KADER = 22, MIN_KADER = 14, VYZVY_DEN = 3;
const FORM = { '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2], '4-5-1': [4, 5, 1], '3-4-3': [3, 4, 3] };
const TAKT = { utok: [1.12, 0.9], vyrov: [1, 1], obrana: [0.88, 1.12] };
const MENA = ['Adam', 'Andrej', 'Boris', 'Dávid', 'Dominik', 'Erik', 'Filip', 'Gabriel', 'Igor', 'Ivan', 'Jakub', 'Ján', 'Jozef', 'Juraj', 'Kamil', 'Karol', 'Kristián', 'Ladislav', 'Lukáš', 'Marek', 'Martin', 'Matej', 'Matúš', 'Michal', 'Milan', 'Miroslav', 'Norbert', 'Ondrej', 'Patrik', 'Pavol', 'Peter', 'Radoslav', 'Richard', 'Róbert', 'Roman', 'Samuel', 'Šimon', 'Stanislav', 'Tibor', 'Tomáš', 'Viktor', 'Vladimír', 'Zoltán'];
const PRIEZ = ['Baláž', 'Benko', 'Bielik', 'Csonka', 'Daňo', 'Dobrota', 'Fekete', 'Gajdoš', 'Hanuliak', 'Horváth', 'Hudec', 'Juhás', 'Kollár', 'Kováč', 'Kováčik', 'Krajčovič', 'Kučera', 'Lacko', 'Lukáč', 'Macko', 'Majerčík', 'Mikuš', 'Molnár', 'Nagy', 'Novák', 'Oravec', 'Pavlík', 'Polák', 'Rybár', 'Sabo', 'Šimko', 'Sloboda', 'Szabó', 'Takáč', 'Tóth', 'Urban', 'Vadovič', 'Varga', 'Vrabec', 'Záhorský', 'Zeman', 'Žiak'];
const POSTY = { B: 'brankár', O: 'obranca', S: 'záložník', U: 'útočník' };

// komentár k zápasu: {h} = hráč, {b} = brankár súpera, {t} = tím
const K_SANCA = [
  '{h} sám pred bránkou… a trafil rohovú zástavku.', '{h} vystrelil tak vysoko, že lopta ešte stále letí.', 'Obrovská šanca! {h} trafil viac trávnika ako lopty.',
  '{b} vytiahol zákrok, aký by nevymyslel ani režisér akčných filmov.', '{h} trafil žrď, brvno a takmer aj kosačku za bránkou.', '{h} sa rozbehol na hlavičku… netrafil loptu, ale spoluhráča áno.',
  '{h} si loptu naťahoval tak dlho, až mu ju zobral vlastný spoluhráč.', '{h} padol v šestnástke tak umelecky, že by dostal Oscara. Rozhodca však píska ďalej.',
  '{b} loptu chytil a ešte si stihol upraviť vlasy.', '{h} skúsil nožničky. Výsledok: kotrmelec a smiech na tribúne.', '{h} vypálil delovku! {b} ju vyrazil na roh, prsty ho budú páliť ešte týždeň.',
  '{h} obišiel troch obrancov aj brankára… a zakopol o vlastnú nohu.', '{h} pálil z 30 metrov, lopta skončila v susedovej záhrade.', 'Krásna akcia, {h} pred prázdnou bránkou… a trafí ležiaceho brankára.',
  '{h} skúša strelu z otočky, tesne vedľa.', 'Nebezpečný center, {h} na loptu nedosiahol o centimeter.', '{h} vystrelil k žrdi, {b} je na mieste.', '{h} kopol do lopty tak silno, že mu vyletela aj kopačka.',
  '{h} chcel prihrať, chcel vystreliť, nakoniec neurobil ani jedno.', '{b} vybehol až k polovici ihriska, {h} lobuje… nad bránu aj nad plot.', '{h} trafil brvno, lopta odskočila do autu. Smola!',
  '{h} sa pokúsil o kľučku, obranca ani nemusel nič robiť.', 'Priamy kop: {h} trafil múr, múr trafil {h}.', '{h} strieľa slabučko, {b} chytá a pýta sa, či to myslel vážne.',
];
const K_GOL = ['Tribúna šalie!', 'Oslavuje saltom, ktoré takmer nedopadlo.', 'Spoluhráči ho zavalili v rohu ihriska.', 'Brankár ani nezdvihol ruky.', 'Aj kosič pri čiare zatlieskal.', 'Toto bude v zostrihu týždňa.', 'Uteká k fanúšikom a posiela pusu tribúne.', 'Lopta sa ešte chvíľu točí v sieti.'];
const K_KOM = [
  'Na ihrisko vbehol pes, chvíľu je najlepším hráčom na trávniku.', 'Rozhodca si zaväzuje šnúrky, hra stojí.', 'Z tribúny sa ozýva: „Hraj to tam!“ Nikto nevie kam.',
  'Lopta preletela cez plot, hľadá ju celá lavička.', 'Tréner {t} gestikuluje tak, že by ho zobrali do divadla.', 'Fanúšikovia spievajú, spev je skôr hlasný ako presný.',
  'Začína pršať, kopačky sa menia na korčule.', 'Pomedzník mával zástavkou, ale vraj len zdravil známeho.', 'Kosič stojí pri čiare a pozerá, či mu nerozkopú trávnik.',
  'Na tribúne sa predala posledná klobása, nálada stúpa.', 'Krava z vedľajšej lúky sleduje zápas s mimoriadnym záujmom.', 'Rozhodca sa pozerá na hodinky. Asi myslí na večeru.',
  'Hráči {t} sa medzi sebou dohadujú, kto mal koho kryť.', 'Fúka taký vietor, že dlhé lopty sa vracajú späť.', 'Lavička {t} je nervózna, náhradník už tretíkrát pije vodu.',
  'Niekto na tribúne tvrdí, že on by to dal aj s papučami.', '{t} drží loptu, súper beží naprázdno.', 'Tempo zápasu kleslo, hráči šetria sily na pivo po zápase.',
];
const rnd = n => Math.floor(Math.random() * n), ch = a => a[rnd(a.length)], cl = (x, a, b) => Math.max(a, Math.min(b, x));
function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
const ovr = h => Math.round(h.post === 'B' ? h.obrana : h.post === 'O' ? h.obrana * 0.75 + h.kond * 0.25 : h.post === 'S' ? (h.utok + h.obrana) * 0.4 + h.kond * 0.2 : h.utok * 0.8 + h.kond * 0.2);
const cena = h => Math.round(100 * Math.pow(1.09, ovr(h) - 40) / 10) * 10;
const tbCena = v => Math.max(1, 1 + Math.floor((v - 50) / 8));

function skNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const hod = +p.hour % 24;
  return { den: `${p.year}-${p.month}-${p.day}`, hod, t: hod * 60 + +p.minute + +p.second / 60 };
}
const plusDni = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export function mzInit(sql) {
  sql(`CREATE TABLE IF NOT EXISTS mz_tim (meno TEXT PRIMARY KEY, nazov TEXT, f1 TEXT, f2 TEXT, erb TEXT, kredit INTEGER, tb INTEGER, tb_tren INTEGER DEFAULT 0, kviz_od TEXT, kviz_kr INTEGER DEFAULT 0, form TEXT, takt TEXT, zostava TEXT, vznik INTEGER)`);
  sql(`CREATE TABLE IF NOT EXISTS mz_hrac (id INTEGER PRIMARY KEY AUTOINCREMENT, tim TEXT, meno TEXT, post TEXT, utok INTEGER, obrana INTEGER, kond INTEGER, forma INTEGER DEFAULT 50, unava INTEGER DEFAULT 0, zran INTEGER DEFAULT 0, goly INTEGER DEFAULT 0, zapasy INTEGER DEFAULT 0, vek INTEGER, trh_den TEXT)`);
  sql(`CREATE TABLE IF NOT EXISTS mz_sez (id INTEGER PRIMARY KEY AUTOINCREMENT, start TEXT, n INTEGER, timy TEXT, rozpis TEXT, odohrane INTEGER DEFAULT 0, majster TEXT)`);
  sql(`CREATE TABLE IF NOT EXISTS mz_zapas (id INTEGER PRIMARY KEY AUTOINCREMENT, sez INTEGER, kolo INTEGER, dom TEXT, hos TEXT, gd INTEGER, gh INTEGER, udalosti TEXT, den TEXT, vyzva INTEGER DEFAULT 0)`);
  try { sql(`ALTER TABLE mz_zapas ADD COLUMN hotovo INTEGER DEFAULT 1`); } catch (e) {}
  try { sql(`ALTER TABLE mz_zapas ADD COLUMN t0 INTEGER`); } catch (e) {}
}

export function manazer(room, path, body, meno, rows, sql) {
  const out = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
  const err = (e, st = 400) => out({ error: e }, st);
  const now = skNow();
  // herná minúta živého kola (null = kolo ešte nezačalo alebo už skončilo)
  const liveMin = den => den === now.den && now.t >= KOLO_HOD * 60 && now.t < KOLO_HOD * 60 + LIVE_MIN ? Math.min(90, Math.floor((now.t - KOLO_HOD * 60) * 90 / LIVE_MIN) + 1) : null;
  // priateľák sa prehráva 5 minút od odohrania
  const vyzMin = t0 => t0 && Date.now() - t0 < VYZVA_MIN * 60000 ? Math.min(90, Math.floor((Date.now() - t0) / 60000 * 90 / VYZVA_MIN) + 1) : null;
  const skoncene = den => den < now.den || (den === now.den && now.t >= KOLO_HOD * 60 + LIVE_MIN);
  const tim = m => rows('SELECT * FROM mz_tim WHERE meno=?', m)[0];
  const hraci = m => rows('SELECT * FROM mz_hrac WHERE tim=? ORDER BY CASE post WHEN \'B\' THEN 0 WHEN \'O\' THEN 1 WHEN \'S\' THEN 2 ELSE 3 END, id', m);

  const novyHrac = (post, base, timM, trhDen) => {
    const v = () => cl(base + rnd(13) - 6, 25, 90);
    let u = v(), o = v(), k = v();
    if (post === 'B') { u = cl(u - 25, 10, 60); }
    if (post === 'O') { u = cl(u - 12, 15, 90); o = cl(o + 6, 20, 95); }
    if (post === 'U') { u = cl(u + 6, 20, 95); o = cl(o - 14, 15, 90); }
    sql('INSERT INTO mz_hrac (tim, meno, post, utok, obrana, kond, forma, vek, trh_den) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', timM, ch(MENA) + ' ' + ch(PRIEZ), post, u, o, k, 45 + rnd(11), 18 + rnd(16), trhDen || null);
  };

  // --- tréningové body a kredity z reálneho sveta (dochádzka zo správcovskej appky, body z kvízu)
  const pripis = t => {
    if (!t) return;
    let tren = 0;
    const p = rows('SELECT data FROM profil WHERE mn=?', normMn(t.meno))[0];
    if (p) { try { for (const m of JSON.parse(p.data).mesiace || []) tren += (m.t || 0); } catch (e) {} }
    const kv = rows('SELECT COALESCE(SUM(s),0) AS s FROM kq_dni WHERE meno=? AND den>=?', t.meno, t.kviz_od || '2000-01-01')[0].s;
    const dtb = Math.max(0, tren - (t.tb_tren || 0)) * TB_TRENING, dkr = Math.max(0, kv - (t.kviz_kr || 0));
    if (dtb || dkr || tren < (t.tb_tren || 0)) {
      sql('UPDATE mz_tim SET tb=tb+?, tb_tren=?, kredit=kredit+?, kviz_kr=? WHERE meno=?', dtb, Math.max(tren, t.tb_tren || 0), dkr, kv, t.meno);
    }
  };

  // --- sila tímu pre zápas
  const auto = (H, form) => {
    const [o, s, u] = FORM[form] || FORM['4-4-2'], vol = H.filter(h => !h.zran), used = new Set(), slot = [];
    const fit = (h, p) => (h.post === p ? 1 : (p === 'B' || h.post === 'B') ? 0.35 : 0.75);
    const val = (h, p) => (p === 'B' ? h.obrana : p === 'O' ? h.obrana : p === 'S' ? (h.utok + h.obrana) / 2 : h.utok) * fit(h, p) * (1 - h.unava / 220);
    for (const [p, n] of [['B', 1], ['O', o], ['S', s], ['U', u]]) for (let i = 0; i < n; i++) {
      const c = vol.filter(h => !used.has(h.id)).sort((a, b) => val(b, p) - val(a, p))[0];
      if (c) { used.add(c.id); slot.push(c.id); }
    }
    return slot;
  };
  const zostava = t => {
    const H = hraci(t.meno), form = FORM[t.form] ? t.form : '4-4-2';
    let ids = []; try { ids = JSON.parse(t.zostava || '[]'); } catch (e) {}
    const by = new Map(H.map(h => [h.id, h]));
    if (ids.length !== 11 || new Set(ids).size !== 11 || ids.some(id => !by.has(id) || by.get(id).zran)) ids = auto(H, form);
    const [o, s] = FORM[form], posty = ['B', ...Array(o).fill('O'), ...Array(s).fill('S'), ...Array(11 - 1 - o - s).fill('U')];
    return { form, takt: TAKT[t.takt] ? t.takt : 'vyrov', hraci: ids.map((id, i) => ({ h: by.get(id), p: posty[i] })).filter(x => x.h) };
  };
  const sila = z => {
    let att = 0, def = 0;
    for (const { h, p } of z.hraci) {
      const fit = h.post === p ? 1 : (p === 'B' || h.post === 'B') ? 0.35 : 0.75, ef = fit * (1 - h.unava / 250) * (1 + (h.forma - 50) / 250);
      if (p === 'B') def += h.obrana * 1.5 * ef;
      if (p === 'O') { def += h.obrana * ef; att += h.utok * 0.2 * ef; }
      if (p === 'S') { def += h.obrana * 0.5 * ef; att += h.utok * 0.6 * ef; }
      if (p === 'U') { att += h.utok * ef; def += h.obrana * 0.15 * ef; }
    }
    const [ta, td] = TAKT[z.takt];
    if (z.hraci.length < 11) { att *= z.hraci.length / 11; def *= z.hraci.length / 11; }
    return { att: att * ta * 1.44, def: def * td };
  };
  // --- simulácia jedného zápasu
  const simuluj = (tA, tB, ostry) => {
    const zA = zostava(tA), zB = zostava(tB), sA = sila(zA), sB = sila(zB);
    const lA = cl(1.3 * Math.pow(sA.att / Math.max(1, sB.def), 1.25) * 1.08, 0.15, 4.5), lB = cl(1.3 * Math.pow(sB.att / Math.max(1, sA.def), 1.25) * 0.95, 0.15, 4.5);
    const gA = poisson(lA), gB = poisson(lB), ev = [];
    const strelec = z => { const w = z.hraci.map(({ h, p }) => (p === 'U' ? 3 : p === 'S' ? 1.4 : p === 'O' ? 0.35 : 0.01) * h.utok); let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return z.hraci[i].h; } return z.hraci[0].h; };
    const SP = ['strelou z diaľky', 'hlavou po rohu', 'po samostatnom nájazde', 'z penalty', 'po krásnej kombinácii', 'dorážkou', 'z priameho kopu', 'nožničkami', 'po chybe obrany'];
    for (const [g, z, s] of [[gA, zA, 'd'], [gB, zB, 'h']]) for (let i = 0; i < g; i++) { const h = strelec(z); ev.push({ m: 1 + rnd(90), t: 'gol', s, h: h.meno, id: h.id, ako: ch(SP), txt: Math.random() < 0.6 ? ch(K_GOL) : '' }); }
    // nepremenené šance a komentár
    const sub = (x, h, z2, t) => x.replace(/\{h\}/g, h).replace(/\{b\}/g, (z2.hraci[0] || { h: { meno: 'brankár' } }).h.meno).replace(/\{t\}/g, t);
    for (const [l, z, z2, s] of [[lA, zA, zB, 'd'], [lB, zB, zA, 'h']]) for (let i = poisson(1.5 + l * 1.6); i > 0; i--) { const h = strelec(z); ev.push({ m: 1 + rnd(90), t: 'sanca', s, h: h.meno, txt: sub(ch(K_SANCA), h.meno, z2, '') }); }
    for (let i = 2 + rnd(3); i > 0; i--) { const s = rnd(2) ? 'd' : 'h', t = s === 'd' ? tA.nazov : tB.nazov; ev.push({ m: 2 + rnd(87), t: 'kom', s: 'n', txt: sub(ch(K_KOM), '', s === 'd' ? zB : zA, t) }); }
    ev.push({ m: 1, t: 'kom', s: 'n', txt: 'Rozhodca pískol, zápas sa začína!' }, { m: 45, t: 'kom', s: 'n', txt: 'Polčas. V šatni sa podáva čaj a výčitky.' }, { m: 90, t: 'kom', s: 'n', txt: 'Koniec zápasu!' });
    for (const [z, s] of [[zA, 'd'], [zB, 'h']]) {
      for (let i = poisson(1.7); i > 0; i--) { const h = ch(z.hraci).h; ev.push({ m: 1 + rnd(90), t: 'zk', s, h: h.meno }); }
      if (Math.random() < 0.05) { const h = ch(z.hraci).h; ev.push({ m: 20 + rnd(70), t: 'ck', s, h: h.meno }); }
      if (ostry) for (const { h } of z.hraci) if (Math.random() < 0.025) { const k = 1 + rnd(3); ev.push({ m: 1 + rnd(90), t: 'zran', s, h: h.meno, id: h.id, k }); }
    }
    const por = e => e.txt === 'Koniec zápasu!' ? 2 : e.txt === 'Rozhodca pískol, zápas sa začína!' ? -1 : e.t === 'kom' && e.m === 45 ? 1 : 0;
    ev.sort((a, b) => a.m - b.m || por(a) - por(b));
    return { gA, gB, ev, zA, zB, xg: [Math.round(lA * 10) / 10, Math.round(lB * 10) / 10] };
  };
  const poZapase = (t, z, g, gs, ev, s) => {
    const hrali = new Set(z.hraci.map(x => x.h.id)), vyhra = g > gs, rem = g === gs;
    for (const h of hraci(t.meno)) {
      const hral = hrali.has(h.id);
      const un = hral ? cl(h.unava + Math.max(6, 20 - Math.round(h.kond / 6)), 0, 100) : cl(h.unava - 25, 0, 100);
      const fo = cl(h.forma + rnd(9) - 4 + (hral ? (vyhra ? 3 : rem ? 0 : -3) : -1), 25, 85);
      const zr = ev.find(e => e.t === 'zran' && e.id === h.id) ? ev.find(e => e.t === 'zran' && e.id === h.id).k : Math.max(0, h.zran - 1);
      const gl = ev.filter(e => e.t === 'gol' && e.id === h.id).length;
      sql('UPDATE mz_hrac SET unava=?, forma=?, zran=?, goly=goly+?, zapasy=zapasy+? WHERE id=?', un, fo, zr, gl, hral ? 1 : 0, h.id);
    }
    sql('UPDATE mz_tim SET kredit=kredit+?, tb=tb+? WHERE meno=?', (vyhra ? 300 : rem ? 150 : 60) + 20 * g, TB_KOLO, t.meno);
  };

  // --- sezóna: rozpis každý s každým, kolá denne o 20:00
  const aktSez = () => rows('SELECT * FROM mz_sez ORDER BY id DESC LIMIT 1')[0];
  const dohraj = () => {
    let s = aktSez();
    const timy = rows('SELECT meno FROM mz_tim').map(r => r.meno);
    // nová sezóna sa vyhlási vopred (2 dni na prihlásenie), tímy sa uzavrú až pri prvom kole
    if (!s && timy.length >= 2) { const st = plusDni(now.den, 2); sql('INSERT INTO mz_sez (start, n) VALUES (?, 0)', st > LIGA_START ? st : LIGA_START); s = aktSez(); }
    else if (s && s.rozpis && s.odohrane >= s.n && plusDni(s.start, s.n + 1) <= now.den) { sql('INSERT INTO mz_sez (start, n) VALUES (?, 0)', plusDni(now.den, 1)); s = aktSez(); }
    if (!s) return null;
    if (!s.rozpis) {
      if (s.start > now.den || (s.start === now.den && now.hod < KOLO_HOD)) return s;
      if (timy.length < 2) return s;
      const T = timy.slice().sort(() => Math.random() - 0.5); if (T.length % 2) T.push(null);
      const n1 = T.length - 1, R1 = [];
      for (let k = 0; k < n1; k++) {
        const kolo = [];
        for (let i = 0; i < T.length / 2; i++) { const a = T[i], b = T[T.length - 1 - i]; if (a && b) kolo.push(k % 2 ? [b, a] : [a, b]); }
        R1.push(kolo); T.splice(1, 0, T.pop());
      }
      // sezóna trvá aspoň mesiac: každý s každým sa opakuje (striedavo doma a vonku), kým nie je aspoň MIN_KOL kôl
      const R = []; for (let c = 0; R.length < MIN_KOL; c++) for (const k of R1) R.push(c % 2 ? k.map(([a, b]) => [b, a]) : k);
      const n = R.length;
      sql('UPDATE mz_sez SET n=?, timy=?, rozpis=? WHERE id=?', n, JSON.stringify(timy), JSON.stringify(R), s.id); s = aktSez();
    }
    const roz = JSON.parse(s.rozpis);
    while (s.odohrane < s.n) {
      const k = s.odohrane + 1, den = plusDni(s.start, k - 1);
      if (den > now.den || (den === now.den && now.hod < KOLO_HOD)) break;
      for (const [a, b] of roz[k - 1]) {
        const tA = tim(a), tB = tim(b);
        if (!tA || !tB) continue;
        const r = simuluj(tA, tB, true);
        // výsledok je hotový hneď, ale ukazuje sa postupne 15 minút; únava, góly a peniaze sa pripíšu až po skončení
        sql('INSERT INTO mz_zapas (sez, kolo, dom, hos, gd, gh, udalosti, den, hotovo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)', s.id, k, a, b, r.gA, r.gB, JSON.stringify({ ev: r.ev, xg: r.xg, zd: r.zA.hraci.map(x => x.h.meno), zh: r.zB.hraci.map(x => x.h.meno), zdi: r.zA.hraci.map(x => x.h.id), zhi: r.zB.hraci.map(x => x.h.id) }), den);
      }
      sql('UPDATE mz_sez SET odohrane=? WHERE id=?', k, s.id);
      s = aktSez();
    }
    for (const z of rows('SELECT * FROM mz_zapas WHERE sez=? AND vyzva=0 AND hotovo=0', s.id)) {
      if (!skoncene(z.den)) continue;
      const u = JSON.parse(z.udalosti), tA = tim(z.dom), tB = tim(z.hos);
      if (tA) poZapase(tA, { hraci: (u.zdi || []).map(id => ({ h: { id } })) }, z.gd, z.gh, u.ev, 'd');
      if (tB) poZapase(tB, { hraci: (u.zhi || []).map(id => ({ h: { id } })) }, z.gh, z.gd, u.ev, 'h');
      sql('UPDATE mz_zapas SET hotovo=1 WHERE id=?', z.id);
    }
    if (s.odohrane >= s.n && !s.majster && !rows('SELECT 1 FROM mz_zapas WHERE sez=? AND vyzva=0 AND hotovo=0', s.id).length) {
      const tb = tabulka(s); if (tb[0]) sql('UPDATE mz_sez SET majster=? WHERE id=?', tb[0].meno, s.id); s = aktSez();
    }
    return s;
  };
  const tabulka = s => {
    const T = {}; for (const m of JSON.parse(s.timy)) { const t = tim(m); if (!t) continue; T[m] = { meno: m, nazov: t ? t.nazov : m, erb: t ? t.erb : '', f1: t ? t.f1 : '', z: 0, v: 0, r: 0, p: 0, gs: 0, gi: 0, b: 0, forma: [] }; }
    for (const z of rows('SELECT dom, hos, gd, gh FROM mz_zapas WHERE sez=? AND vyzva=0 AND hotovo=1 ORDER BY kolo', s.id)) {
      for (const [m, g, gi] of [[z.dom, z.gd, z.gh], [z.hos, z.gh, z.gd]]) { const x = T[m]; if (!x) continue; x.z++; x.gs += g; x.gi += gi; if (g > gi) { x.v++; x.b += 3; x.forma.push('V'); } else if (g === gi) { x.r++; x.b++; x.forma.push('R'); } else { x.p++; x.forma.push('P'); } }
    }
    return Object.values(T).map(x => ({ ...x, forma: x.forma.slice(-5) })).sort((a, b) => b.b - a.b || (b.gs - b.gi) - (a.gs - a.gi) || b.gs - a.gs || a.nazov.localeCompare(b.nazov));
  };
  // --- trh: voľní hráči, obnovuje sa denne
  const trh = () => {
    if (!rows('SELECT 1 FROM mz_hrac WHERE tim IS NULL AND trh_den=?', now.den).length) {
      sql('DELETE FROM mz_hrac WHERE tim IS NULL');
      for (let i = 0; i < 12; i++) novyHrac(ch(['B', 'O', 'O', 'S', 'S', 'S', 'U', 'U']), 38 + rnd(30), null, now.den);
    }
    return rows('SELECT * FROM mz_hrac WHERE tim IS NULL ORDER BY id').map(h => ({ ...h, ovr: ovr(h), cena: cena(h) }));
  };

  const t0 = tim(meno);
  if (path === '/mz/zaloz') {
    if (t0) return err('Tím už máš.');
    const nazov = String(body.nazov || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    if (nazov.length < 3) return err('Názov tímu musí mať aspoň 3 znaky.');
    if (rows('SELECT 1 FROM mz_tim WHERE lower(nazov)=lower(?)', nazov).length) return err('Tím s takým názvom už existuje.');
    const col = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#ffffff';
    sql('INSERT INTO mz_tim (meno, nazov, f1, f2, erb, kredit, tb, kviz_od, form, takt, zostava, vznik, tb_tren) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
      meno, nazov, col(body.f1), col(body.f2), String(body.erb || '⚽').slice(0, 4), START_KREDIT, 10, now.den > LIGA_START ? now.den : LIGA_START, '4-4-2', 'vyrov', '[]', Date.now());
    for (const p of ['B', 'B', 'O', 'O', 'O', 'O', 'O', 'S', 'S', 'S', 'S', 'S', 'U', 'U', 'U', 'U']) novyHrac(p, 46, meno);
    // tréningy pred založením tímu sa nerátajú
    const p = rows('SELECT data FROM profil WHERE mn=?', normMn(meno))[0]; let tren = 0;
    if (p) { try { for (const m of JSON.parse(p.data).mesiace || []) tren += (m.t || 0); } catch (e) {} }
    sql('UPDATE mz_tim SET tb_tren=? WHERE meno=?', tren, meno);
  }
  const s = dohraj();
  const t = tim(meno);
  if (t) pripis(t);

  if (path === '/mz/upravit' && t) {
    const col = c => /^#[0-9a-f]{6}$/i.test(c) ? c : null;
    sql('UPDATE mz_tim SET erb=?, f1=COALESCE(?, f1), f2=COALESCE(?, f2) WHERE meno=?', String(body.erb || t.erb || '⚽').slice(0, 4), col(body.f1), col(body.f2), meno);
  }
  if (path === '/mz/zmaz' && t) {
    // tím zmizne aj z bežiacej sezóny (jeho zostávajúce zápasy sa neodohrajú), odohrané výsledky ostanú v tabuľke súperov
    sql('DELETE FROM mz_hrac WHERE tim=?', meno); sql('DELETE FROM mz_tim WHERE meno=?', meno);
    return out({ zmazany: true });
  }
  if (path === '/mz/zostava' && t) {
    const form = FORM[body.form] ? body.form : t.form, takt = TAKT[body.takt] ? body.takt : t.takt;
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).slice(0, 11) : [];
    const moji = new Set(hraci(meno).filter(h => !h.zran).map(h => h.id));
    sql('UPDATE mz_tim SET form=?, takt=?, zostava=? WHERE meno=?', form, takt, JSON.stringify(ids.length === 11 && ids.every(i => moji.has(i)) && new Set(ids).size === 11 ? ids : []), meno);
  }
  if (path === '/mz/trening' && t) {
    const h = rows('SELECT * FROM mz_hrac WHERE id=? AND tim=?', Number(body.id), meno)[0], a = ['utok', 'obrana', 'kond'].includes(body.attr) ? body.attr : null;
    if (!h || !a) return err('Zlé údaje.');
    if (h[a] >= 99) return err('Tento hráč je už na maxime.');
    const c = tbCena(h[a]), tt = tim(meno);
    if (tt.tb < c) return err(`Treba ${c} TB, máš ${tt.tb}.`);
    sql(`UPDATE mz_hrac SET ${a}=${a}+1 WHERE id=?`, h.id); sql('UPDATE mz_tim SET tb=tb-? WHERE meno=?', c, meno);
  }
  if (path === '/mz/kup' && t) {
    const h = rows('SELECT * FROM mz_hrac WHERE id=? AND tim IS NULL', Number(body.id))[0];
    if (!h) return err('Hráč už nie je na trhu.');
    if (hraci(meno).length >= MAX_KADER) return err(`V kádri môžeš mať najviac ${MAX_KADER} hráčov.`);
    const c = cena(h), tt = tim(meno);
    if (tt.kredit < c) return err(`Hráč stojí ${c} kreditov, máš ${tt.kredit}.`);
    sql('UPDATE mz_hrac SET tim=?, trh_den=NULL, unava=0 WHERE id=?', meno, h.id); sql('UPDATE mz_tim SET kredit=kredit-? WHERE meno=?', c, meno);
  }
  if (path === '/mz/predaj' && t) {
    const h = rows('SELECT * FROM mz_hrac WHERE id=? AND tim=?', Number(body.id), meno)[0];
    if (!h) return err('Zlé údaje.');
    if (hraci(meno).length <= MIN_KADER) return err(`V kádri musí ostať aspoň ${MIN_KADER} hráčov.`);
    if (h.post === 'B' && hraci(meno).filter(x => x.post === 'B').length <= 1) return err('Posledného brankára predať nemôžeš.');
    sql('DELETE FROM mz_hrac WHERE id=?', h.id); sql('UPDATE mz_tim SET kredit=kredit+? WHERE meno=?', Math.round(cena(h) / 2), meno);
  }
  if (path === '/mz/zapas') {
    const z = rows('SELECT * FROM mz_zapas WHERE id=?', Number(body.id))[0];
    if (!z) return err('Zápas sa nenašiel.', 404);
    const a = tim(z.dom), b = tim(z.hos), u = JSON.parse(z.udalosti), lm = z.vyzva ? vyzMin(z.t0) : z.hotovo ? null : liveMin(z.den);
    if (lm != null) { u.ev = u.ev.filter(e => e.m <= lm); z.gd = u.ev.filter(e => e.t === 'gol' && e.s === 'd').length; z.gh = u.ev.filter(e => e.t === 'gol' && e.s === 'h').length; z.live = lm; u.xg = null; }
    delete u.zdi; delete u.zhi;
    return out({ zapas: { ...z, udalosti: u, dn: a ? a.nazov : z.dom, hn: b ? b.nazov : z.hos, de: a ? a.erb : '', he: b ? b.erb : '' } });
  }
  if (path === '/mz/vyzva' && t) {
    const b = tim(String(body.super || ''));
    if (!b || b.meno === meno) return err('Vyber súpera.');
    const dnes = rows('SELECT COUNT(*) AS n FROM mz_zapas WHERE vyzva=1 AND dom=? AND den=?', meno, now.den)[0].n;
    if (dnes >= VYZVY_DEN) return err(`Dnes si už odohral ${VYZVY_DEN} priateľské zápasy.`);
    const r = simuluj(tim(meno), b, false);
    sql('INSERT INTO mz_zapas (sez, kolo, dom, hos, gd, gh, udalosti, den, vyzva, t0) VALUES (0, 0, ?, ?, ?, ?, ?, ?, 1, ?)', meno, b.meno, r.gA, r.gB, JSON.stringify({ ev: r.ev, xg: r.xg, zd: r.zA.hraci.map(x => x.h.meno), zh: r.zB.hraci.map(x => x.h.meno) }), now.den, Date.now());
    return out({ vyzva: rows('SELECT id FROM mz_zapas WHERE vyzva=1 AND dom=? ORDER BY id DESC LIMIT 1', meno)[0].id });
  }

  // --- stav pre obrazovku
  const T = tim(meno);
  const timy = rows('SELECT meno, nazov, erb, f1, f2 FROM mz_tim ORDER BY nazov');
  let sez = null;
  if (s && !s.rozpis) { const k = Math.max(1, rows('SELECT COUNT(*) AS n FROM mz_tim')[0].n - 1); sez = { id: s.id, start: s.start, pripravuje: true, n: Math.ceil(MIN_KOL / k) * k }; }
  else if (s) {
    const kola = rows('SELECT id, kolo, dom, hos, gd, gh, den, hotovo, udalosti FROM mz_zapas WHERE sez=? AND vyzva=0 ORDER BY kolo DESC, id', s.id).map(z => {
      const lm = z.hotovo ? null : liveMin(z.den), o = { id: z.id, kolo: z.kolo, dom: z.dom, hos: z.hos, gd: z.gd, gh: z.gh, den: z.den };
      if (lm != null) { const ev = JSON.parse(z.udalosti).ev.filter(e => e.t === 'gol' && e.m <= lm); o.gd = ev.filter(e => e.s === 'd').length; o.gh = ev.filter(e => e.s === 'h').length; o.live = lm; }
      return o;
    });
    const roz = JSON.parse(s.rozpis), dalsie = s.odohrane < s.n ? { kolo: s.odohrane + 1, den: plusDni(s.start, s.odohrane), zapasy: roz[s.odohrane] } : null;
    const strelci = rows(`SELECT h.meno, h.tim, h.goly FROM mz_hrac h WHERE h.tim IS NOT NULL AND h.goly > 0 ORDER BY h.goly DESC LIMIT 10`);
    sez = { id: s.id, start: s.start, n: s.n, odohrane: s.odohrane, majster: s.majster, tabulka: tabulka(s), posledne: kola.filter(z => z.kolo === s.odohrane), mojeZapasy: T ? kola.filter(z => z.dom === meno || z.hos === meno) : [], dalsie, strelci, ucastnik: T ? JSON.parse(s.timy).includes(meno) : false, koniec: plusDni(s.start, s.n - 1) };
  }
  const minuli = rows('SELECT id, majster FROM mz_sez WHERE majster IS NOT NULL ORDER BY id DESC LIMIT 5').map(x => ({ id: x.id, majster: x.majster, nazov: (tim(x.majster) || {}).nazov }));
  return out({
    meno, kolo_hod: KOLO_HOD, liga_start: LIGA_START, live_min: LIVE_MIN, timy, sez, minuli,
    tim: T ? { ...T, zostava: zostava(T).hraci.map(x => ({ id: x.h.id, p: x.p })), hraci: hraci(meno).map(h => ({ ...h, ovr: ovr(h), cena: cena(h), tbU: tbCena(h.utok), tbO: tbCena(h.obrana), tbK: tbCena(h.kond) })), vyzvy: rows('SELECT id, dom, hos, gd, gh, t0, udalosti FROM mz_zapas WHERE vyzva=1 AND (dom=? OR hos=?) ORDER BY id DESC LIMIT 5', meno, meno).map(z => { const lm = vyzMin(z.t0), o = { id: z.id, dom: z.dom, hos: z.hos, gd: z.gd, gh: z.gh }; if (lm != null) { const ev = JSON.parse(z.udalosti).ev.filter(e => e.t === 'gol' && e.m <= lm); o.gd = ev.filter(e => e.s === 'd').length; o.gh = ev.filter(e => e.s === 'h').length; o.live = lm; } return o; }) } : null,
    trh: T ? trh() : [],
    pravidla: { TB_TRENING, TB_KOLO, MAX_KADER, MIN_KADER, VYZVY_DEN, formacie: Object.keys(FORM) },
  });
}
const normMn = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
