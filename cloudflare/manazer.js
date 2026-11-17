// Beša manažér (plná verzia): každý hráč klubu má fiktívny tím, ligu, pohár a superpohár simuluje server.
// Ligové kolá sa hrajú každý deň o 20:00, pohár o 18:00 (živý prenos 15 minút). Pri viac ako 12 tímoch dve ligy s postupom a zostupom.
// Tréningové body (TB) za skutočné tréningy (podľa dochádzky vedenia), kredity za body z kvízu a za zápasy, vstupné a platy.

const LIGA_START = '2026-12-01', LIVE_MIN = 15, VYZVA_MIN = 5; // prvá sezóna; body z kvízu sa rátajú až odtiaľto
const LIGA_DNI = 20, POHAR_MAX = 8, KOLO_HOD = 20, POHAR_HOD = 18, TB_TRENING = 3, TB_KOLO = 1, START_KREDIT = 1000, MAX_KADER = 22, MIN_KADER = 14, VYZVY_DEN = 3, DIV_LIMIT = 12, POSTUP = 2;
const FORM = { '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2], '4-5-1': [4, 5, 1], '3-4-3': [3, 4, 3] };
const TAKT = { utok: [1.12, 0.9], vyrov: [1, 1], obrana: [0.88, 1.12] };
const PRESING = { nizky: { a: 0.95, d: 1.04, u: 0.8, f: 0.7 }, stredny: { a: 1, d: 1, u: 1, f: 1 }, vysoky: { a: 1.07, d: 0.97, u: 1.35, f: 1.4 } };
const STYL = { kombinacia: 'technika', kridla: 'rychlost', dlhe: 'hlavicky', protiutoky: 'rychlost' };
const STADION = [{ kap: 150, cena: 0 }, { kap: 300, cena: 1500 }, { kap: 600, cena: 4000 }, { kap: 1200, cena: 9000 }, { kap: 2500, cena: 20000 }];
const MENA = ['Adam', 'Andrej', 'Boris', 'Dávid', 'Dominik', 'Erik', 'Filip', 'Gabriel', 'Igor', 'Ivan', 'Jakub', 'Ján', 'Jozef', 'Juraj', 'Kamil', 'Karol', 'Kristián', 'Ladislav', 'Lukáš', 'Marek', 'Martin', 'Matej', 'Matúš', 'Michal', 'Milan', 'Miroslav', 'Norbert', 'Ondrej', 'Patrik', 'Pavol', 'Peter', 'Radoslav', 'Richard', 'Róbert', 'Roman', 'Samuel', 'Šimon', 'Stanislav', 'Tibor', 'Tomáš', 'Viktor', 'Vladimír', 'Zoltán'];
const PRIEZ = ['Baláž', 'Benko', 'Bielik', 'Csonka', 'Daňo', 'Dobrota', 'Fekete', 'Gajdoš', 'Hanuliak', 'Horváth', 'Hudec', 'Juhás', 'Kollár', 'Kováč', 'Kováčik', 'Krajčovič', 'Kučera', 'Lacko', 'Lukáč', 'Macko', 'Majerčík', 'Mikuš', 'Molnár', 'Nagy', 'Novák', 'Oravec', 'Pavlík', 'Polák', 'Rybár', 'Sabo', 'Šimko', 'Sloboda', 'Szabó', 'Takáč', 'Tóth', 'Urban', 'Vadovič', 'Varga', 'Vrabec', 'Záhorský', 'Zeman', 'Žiak'];
const POSTY = { B: 'brankár', O: 'obranca', S: 'záložník', U: 'útočník' };

// komentár k zápasu: {h} = hráč, {b} = brankár súpera, {t} = tím
const K_SANCA = [
  '{h} vystrelil, lopta sa pomaly kotúľa… a zastaví sa centimeter pred čiarou.',
  '{h} strieľa a lopta mieri presne do rúk brankára. Ako keby mu ju podával.',
  '{h} chcel vystreliť pätičkou. Nevyšlo to, ale vyzeralo to fantasticky.',
  '{h} kopol do zeme a lopta len zaskákala k bránke ako zajac.',
  '{h} uniká po krídle, center… do protismeru, rovno na tribúnu.',
  '{b} sa hodil a vyškriabal loptu z rohu. Tribúna tlieska aj súperovi.',
  '{h} hlavičkuje po rohu tesne nad brvno. Účes však vydržal.',
  '{h} išiel do súboja, spadol a ešte chvíľu sa váľal pre istotu.',
  '{h} strieľa z voleja… lopta končí na streche šatne.',
  '{b} vyráža strelu kolenom, ani sám nevie ako.',
  'Ešte chvíľu a bol by to gól storočia. {h} však trafil hlavu vlastného spoluhráča.',
  '{h} kľučkuje, kľučkuje, kľučkuje… až sa zamotal sám do seba.',
  '{h} sa ocitol sám pred brankárom a zrazu zabudol, ktorou nohou kope.',
  'Štvrtá šanca a stále nič. {h} sa pozerá do neba, či tam nie je odpoveď.',
  '{h} strieľa z rohu šestnástky, lopta lízla žrď a odišla do autu.',
  '{h} chcel prekvapiť brankára strelou spoza polovice. Prekvapil hlavne lavičku.',
  '{b} chytá strelu tak isto, ako keby chytal vajce.',
  '{h} sa rozbieha na penaltu… nie, to len zakopol pri rozbehu na roh.',
  '{h} obhodil obrancu a potom aj seba. Lopta ostala sama na trávniku.',
  '{h} skúšal vtipnú vlásočnicu. Vtipná bola, presná nie.',
  'Obrovská príležitosť! {h} si však nevšimol, že je sám, a prihrával.',
  '{h} vystrelil do brvna tak silno, že sa bránka ešte chvíľu triasla.',
  '{h} posiela loptu k žrdi, {b} sa naťahuje celý a vyškriabe ju.',
  '{h} hlavou do žrde. Lopte to neublížilo, {h} si drží čelo.',
  '{h} strieľal tak slabo, že lopta stihla cestou k bránke zívnuť.',
  '{h} sa rozhodol vystreliť po zemi. Zem vyhrala.',
  '{b} vyrazil strelu a ešte na strelca žmurkol.',
  '{h} prekonal brankára, ale obranca vykopol loptu z bránkovej čiary.',
  '{h} kopol loptu do vlastného tieňa. Tieň sa nebránil.',
  '{h} skúša pätičku, druhú pätičku, tretiu pätičku… a lopta je v zajatí obrany.',
  '{h} sám pred bránkou… a trafil rohovú zástavku.', '{h} vystrelil tak vysoko, že lopta ešte stále letí.', 'Obrovská šanca! {h} trafil viac trávnika ako lopty.',
  '{b} vytiahol zákrok, aký by nevymyslel ani režisér akčných filmov.', '{h} trafil žrď, brvno a takmer aj kosačku za bránkou.', '{h} sa rozbehol na hlavičku… netrafil loptu, ale spoluhráča áno.',
  '{h} si loptu naťahoval tak dlho, až mu ju zobral vlastný spoluhráč.', '{h} padol v šestnástke tak umelecky, že by dostal Oscara. Rozhodca však píska ďalej.',
  '{b} loptu chytil a ešte si stihol upraviť vlasy.', '{h} skúsil nožničky. Výsledok: kotrmelec a smiech na tribúne.', '{h} vypálil delovku! {b} ju vyrazil na roh, prsty ho budú páliť ešte týždeň.',
  '{h} obišiel troch obrancov aj brankára… a zakopol o vlastnú nohu.', '{h} pálil z 30 metrov, lopta skončila v susedovej záhrade.', 'Krásna akcia, {h} pred prázdnou bránkou… a trafí ležiaceho brankára.',
  '{h} skúša strelu z otočky, tesne vedľa.', 'Nebezpečný center, {h} na loptu nedosiahol o centimeter.', '{h} vystrelil k žrdi, {b} je na mieste.', '{h} kopol do lopty tak silno, že mu vyletela aj kopačka.',
  '{h} chcel prihrať, chcel vystreliť, nakoniec neurobil ani jedno.', '{b} vybehol až k polovici ihriska, {h} lobuje… nad bránu aj nad plot.', '{h} trafil brvno, lopta odskočila do autu. Smola!',
  '{h} sa pokúsil o kľučku, obranca ani nemusel nič robiť.', 'Priamy kop: {h} trafil múr a múr mu to vrátil rovno do brucha.', '{h} strieľa slabučko, {b} chytá a pýta sa, či to myslel vážne.',
];
const K_GOL = [
  'Strelec sa rozbehol k rohovej zástavke a tancoval, ako keby bol sám doma.',
  'Brankár sa ešte obzerá, kde je lopta.',
  'Hlásateľ na ihrisku skoro prišiel o hlas.',
  'Takýto gól tu nevideli od čias, keď sa hralo na škváre.',
  'Strelec si vyzliekol dres, rozhodca vyťahuje žltú. Oplatilo sa?',
  'Lopta prešla brankárovi pomedzi nohy. Jasličky ako vyšité.',
  'Spoluhráči ho nesú na pleciach, aj keď je ešte iba stredná časť zápasu.',
  'Babička na tribúne vyskočila vyššie ako brankár.',
  'Strelec sa uklonil ako hviezda na koncerte.',
  'Do siete to išlo takou rýchlosťou, že sieť vydala zvuk ako bubon.',
  'Tréner na lavičke spravil gesto, ktoré si nikto netrúfne zopakovať.',
  'Gól ako z učebnice. Len nikto nevie z ktorej.',
  'Brankár zúfalo pozerá na obrancov, obrancovia pozerajú do zeme.',
  'Strelec beží k lavičke a objíma aj maséra.',
  'Rozhodca chvíľu váha, potom ukazuje na stred. Platí!','Tribúna šalie!', 'Oslavuje saltom, ktoré takmer nedopadlo.', 'Spoluhráči ho zavalili v rohu ihriska.', 'Brankár ani nezdvihol ruky.', 'Aj kosič pri čiare zatlieskal.', 'Toto bude v zostrihu týždňa.', 'Uteká k fanúšikom a posiela pusu tribúne.', 'Lopta sa ešte chvíľu točí v sieti.'];
const K_ZK = ['vraj to bol len kamarátsky dotyk', 'za reči na rozhodcu', 'za zdržiavanie hry', 'za faul zozadu', 'za ruku, ktorú vraj nevidel ani on', 'za teatrálny pád', 'za predčasné vybehnutie z múru', 'za sťahovanie dresu', 'za oslavu gólu, ktorý neplatil', 'za skákanie súperovi do cesty', 'rozhodcu nepresvedčil ani úsmevom'];
const K_ZRAN = ['odchádza krívajúc, masér sa tvári vážne', 'vraj ho zasiahla lopta aj sebaľútosť', 'ostal ležať, odnášajú ho na nosidlách', 'drží si stehno a smutne pozerá na lavičku', 'natiahol si sval pri pokuse o nožničky'];
const K_KOM = [
  'Domáci kapitán kričí pokyny, ktorým nerozumie ani on sám.',
  'Rozhodca odpískal faul, ktorý videl iba on.',
  'Na tribúne niekto prvýkrát zistil, kto hrá za koho.',
  'Lopta mäkne, rozhodca posiela po náhradnú.',
  'Hráči {t} sa chvíľu radia, kto kope roh. Nakoniec ho kope ten, kto nemal.',
  'Kosič pri čiare zaznamenal, že tráva rastie rýchlejšie ako skóre.',
  'Do stredového kruhu priletel holub a odmieta odísť.',
  'Z ampliónu hrá pieseň, ktorú nikto nechcel, ale všetci si ju pospevujú.',
  'Hráči sa šmýkajú, niekto zabudol na kolíky.',
  'Lavička {t} si objednáva cez plot pizzu. Rozhodca to radšej nevidí.',
  'Masér {t} beží so špongiou tak rýchlo, že by mohol nastúpiť.',
  'Pomedzník sa skoro zrazil s fotografom.',
  'Trénerovi {t} odletela šiltovka, naháňa ju rovno cez lavičku súpera.',
  'Hrá sa už iba na jednu polovicu, druhá polovica ihriska zíva.',
  'Fanúšik na tribúne radí tak hlasno, že ho počuje aj susedná obec.',
  'Rozhodca si dal oddych, hráči si zatiaľ zaviazali kopačky.',
  'Psík, ktorý tu bol v prvom polčase, je späť. Vyzerá to na rozhodujúci moment.',
  'Hráči {t} hrajú tak pomaly, že by to stihol komentovať aj dedko z tribúny.',
  'Vietor otočil smer, teraz fúka do chrbta {t}.',
  'Na ihrisko sa zatúlala lopta z vedľajšieho detského ihriska. Chvíľu sa hrá s dvomi.',
  'Kapitán {t} sa háda s rozhodcom o farbe trávnika.',
  'Na tribúne sa začína debata, či to bol ofsajd. Debata potrvá do zajtra.',
  'Tréner {t} posiela na rozcvičku troch náhradníkov naraz. Nervózny?',
  'Rozhodca pozerá na mobil. Asi kontroluje VAR na Sportnete.',
  'Hráč {t} si vymenil kopačky na lavičke a vybehol v rôznych farbách.',
  'Z vedľajšej záhrady sa šíri vôňa guláša. Hráči strácajú koncentráciu.',
  'Do zápasu sa vkradlo trochu kultúry: hráči sa navzájom ospravedlňujú za fauly.',
  'Za bránkou dvaja chlapci ukazujú ceduľku „DAJ GÓL“. Nikto ich nepočúva.',
  'Svetlá na ihrisku blikli, na chvíľu všetci zamrzli.',
  'Zápas sa trochu spomalil, hráči {t} si zrejme pamätajú zajtrajšiu prácu.',
  'Na ihrisko vbehol pes, chvíľu je najlepším hráčom na trávniku.', 'Rozhodca si zaväzuje šnúrky, hra stojí.', 'Z tribúny sa ozýva: „Hraj to tam!“ Nikto nevie kam.',
  'Lopta preletela cez plot, hľadá ju celá lavička.', 'Tréner {t} gestikuluje tak, že by ho zobrali do divadla.', 'Fanúšikovia spievajú, spev je skôr hlasný ako presný.',
  'Začína pršať, kopačky sa menia na korčule.', 'Pomedzník mával zástavkou, ale vraj len zdravil známeho.', 'Kosič stojí pri čiare a pozerá, či mu nerozkopú trávnik.',
  'Na tribúne sa predala posledná klobása, nálada stúpa.', 'Krava z vedľajšej lúky sleduje zápas s mimoriadnym záujmom.', 'Rozhodca sa pozerá na hodinky. Asi myslí na večeru.',
  'Hráči {t} sa medzi sebou dohadujú, kto mal koho kryť.', 'Fúka taký vietor, že dlhé lopty sa vracajú späť.', 'Lavička {t} je nervózna, náhradník už tretíkrát pije vodu.',
  'Niekto na tribúne tvrdí, že on by to dal aj s papučami.', '{t} drží loptu, súper beží naprázdno.', 'Tempo zápasu kleslo, hráči šetria sily na pivo po zápase.',
];

const rnd = n => Math.floor(Math.random() * n), ch = a => a[rnd(a.length)], cl = (x, a, b) => Math.max(a, Math.min(b, x));
function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const A = (h, k) => h[k] == null ? 45 : h[k];
const ATTR = ['utok', 'obrana', 'kond', 'rychlost', 'technika', 'hlavicky', 'nervy'];
const ovr = h => Math.round(h.post === 'B' ? A(h, 'obrana') * 0.85 + A(h, 'nervy') * 0.15
  : h.post === 'O' ? A(h, 'obrana') * 0.6 + A(h, 'kond') * 0.15 + A(h, 'hlavicky') * 0.15 + A(h, 'rychlost') * 0.1
  : h.post === 'S' ? A(h, 'utok') * 0.3 + A(h, 'obrana') * 0.25 + A(h, 'technika') * 0.25 + A(h, 'kond') * 0.2
  : A(h, 'utok') * 0.55 + A(h, 'rychlost') * 0.15 + A(h, 'technika') * 0.15 + A(h, 'hlavicky') * 0.15);
const vekF = v => v < 21 ? 1.35 : v < 25 ? 1.15 : v < 30 ? 1 : v < 33 ? 0.75 : 0.5;
const cena = h => Math.round(100 * Math.pow(1.09, ovr(h) - 40) * vekF(h.vek || 25) * (h.potencial > ovr(h) ? 1 + (h.potencial - ovr(h)) / 80 : 1) / 10) * 10;
const plat = h => Math.max(2, Math.round(Math.pow(Math.max(0, ovr(h) - 30), 1.6) / 15));
const tbCena = v => Math.max(1, 1 + Math.floor((v - 50) / 8));

function skNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const hod = +p.hour % 24;
  return { den: `${p.year}-${p.month}-${p.day}`, hod, t: hod * 60 + +p.minute + +p.second / 60 };
}
const plusDni = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export function mzInit(sql) {
  const tryS = q => { try { sql(q); } catch (e) {} };
  sql(`CREATE TABLE IF NOT EXISTS mz_tim (meno TEXT PRIMARY KEY, nazov TEXT, f1 TEXT, f2 TEXT, erb TEXT, kredit INTEGER, tb INTEGER, tb_tren INTEGER DEFAULT 0, kviz_od TEXT, kviz_kr INTEGER DEFAULT 0, form TEXT, takt TEXT, zostava TEXT, vznik INTEGER)`);
  for (const c of ['stadion INTEGER DEFAULT 1', 'fans INTEGER DEFAULT 100', 'vstupne INTEGER DEFAULT 2', "taktika TEXT DEFAULT '{}'", "striedania TEXT DEFAULT '[]'"]) tryS(`ALTER TABLE mz_tim ADD COLUMN ${c}`);
  sql(`CREATE TABLE IF NOT EXISTS mz_hrac (id INTEGER PRIMARY KEY AUTOINCREMENT, tim TEXT, meno TEXT, post TEXT, utok INTEGER, obrana INTEGER, kond INTEGER, forma INTEGER DEFAULT 50, unava INTEGER DEFAULT 0, zran INTEGER DEFAULT 0, goly INTEGER DEFAULT 0, zapasy INTEGER DEFAULT 0, vek INTEGER, trh_den TEXT)`);
  for (const c of ['trest INTEGER DEFAULT 0', 'rychlost INTEGER', 'technika INTEGER', 'hlavicky INTEGER', 'nervy INTEGER', 'potencial INTEGER DEFAULT 0', 'odchovanec INTEGER DEFAULT 0']) tryS(`ALTER TABLE mz_hrac ADD COLUMN ${c}`);
  sql(`UPDATE mz_hrac SET rychlost = kond + (abs(random()) % 11) - 5, technika = (utok + obrana) / 2 + (abs(random()) % 11) - 5, hlavicky = (utok + obrana) / 2 + (abs(random()) % 13) - 6, nervy = 45 + (abs(random()) % 15) WHERE rychlost IS NULL`);
  sql(`CREATE TABLE IF NOT EXISTS mz_sez (id INTEGER PRIMARY KEY AUTOINCREMENT, start TEXT, n INTEGER, timy TEXT, rozpis TEXT, odohrane INTEGER DEFAULT 0, majster TEXT)`);
  for (const c of ['divizie TEXT', 'pohar TEXT', 'super TEXT', 'archiv TEXT', 'dni TEXT']) tryS(`ALTER TABLE mz_sez ADD COLUMN ${c}`);
  sql(`CREATE TABLE IF NOT EXISTS mz_zapas (id INTEGER PRIMARY KEY AUTOINCREMENT, sez INTEGER, kolo INTEGER, dom TEXT, hos TEXT, gd INTEGER, gh INTEGER, udalosti TEXT, den TEXT, vyzva INTEGER DEFAULT 0)`);
  for (const c of ['hotovo INTEGER DEFAULT 1', 't0 INTEGER', "typ TEXT DEFAULT 'liga'", 'div INTEGER DEFAULT 1', 'hod INTEGER DEFAULT 20', 'pen TEXT']) tryS(`ALTER TABLE mz_zapas ADD COLUMN ${c}`);
  sql(`CREATE TABLE IF NOT EXISTS mz_stat (sez INTEGER, hid INTEGER, meno TEXT, tim TEXT, goly INTEGER DEFAULT 0, zapasy INTEGER DEFAULT 0, PRIMARY KEY (sez, hid))`);
  sql(`CREATE TABLE IF NOT EXISTS mz_ponuka (id INTEGER PRIMARY KEY AUTOINCREMENT, hid INTEGER, kupec TEXT, predajca TEXT, cena INTEGER, stav TEXT DEFAULT 'caka', t INTEGER)`);
  sql(`CREATE TABLE IF NOT EXISTS mz_log (id INTEGER PRIMARY KEY AUTOINCREMENT, tim TEXT, t INTEGER, txt TEXT)`);
}

export function manazer(room, path, body, meno, rows, sql) {
  const out = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
  const err = (e, st = 400) => out({ error: e }, st);
  const now = skNow();
  const liveMin = (den, hod = KOLO_HOD) => den === now.den && now.t >= hod * 60 && now.t < hod * 60 + LIVE_MIN ? Math.min(90, Math.floor((now.t - hod * 60) * 90 / LIVE_MIN) + 1) : null;
  const vyzMin = t0 => t0 && Date.now() - t0 < VYZVA_MIN * 60000 ? Math.min(90, Math.floor((Date.now() - t0) / 60000 * 90 / VYZVA_MIN) + 1) : null;
  const skoncene = (den, hod = KOLO_HOD) => den < now.den || (den === now.den && now.t >= hod * 60 + LIVE_MIN);
  const nadosah = (den, hod) => den < now.den || (den === now.den && now.hod >= hod);
  const tim = m => rows('SELECT * FROM mz_tim WHERE meno=?', m)[0];
  const hraci = m => rows("SELECT * FROM mz_hrac WHERE tim=? ORDER BY CASE post WHEN 'B' THEN 0 WHEN 'O' THEN 1 WHEN 'S' THEN 2 ELSE 3 END, id", m);
  const log = (m, txt) => { if (m) sql('INSERT INTO mz_log (tim, t, txt) VALUES (?, ?, ?)', m, Date.now(), txt); };
  const J = (x, d) => { try { const v = JSON.parse(x || ''); return v == null ? d : v; } catch (e) { return d; } };

  const novyHrac = (post, base, timM, trhDen, vek, mlady) => {
    const v = () => cl(base + rnd(13) - 6, 20, 92), h = { post, utok: v(), obrana: v(), kond: v(), rychlost: v(), technika: v(), hlavicky: v(), nervy: v() };
    if (post === 'B') { h.utok = cl(h.utok - 25, 10, 60); h.obrana = cl(h.obrana + 4, 20, 95); h.rychlost = cl(h.rychlost - 8, 15, 90); }
    if (post === 'O') { h.utok = cl(h.utok - 12, 15, 90); h.obrana = cl(h.obrana + 6, 20, 95); h.hlavicky = cl(h.hlavicky + 4, 20, 95); }
    if (post === 'S') { h.technika = cl(h.technika + 4, 20, 95); }
    if (post === 'U') { h.utok = cl(h.utok + 6, 20, 95); h.obrana = cl(h.obrana - 14, 15, 90); h.rychlost = cl(h.rychlost + 3, 20, 95); }
    const age = vek || 18 + rnd(16), pot = age <= 21 ? cl(ovr(h) + 8 + rnd(mlady ? 30 : 18), 40, 95) : 0;
    sql('INSERT INTO mz_hrac (tim, meno, post, utok, obrana, kond, rychlost, technika, hlavicky, nervy, forma, vek, trh_den, potencial, odchovanec) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      timM, ch(MENA) + ' ' + ch(PRIEZ), post, h.utok, h.obrana, h.kond, h.rychlost, h.technika, h.hlavicky, h.nervy, 45 + rnd(11), age, trhDen || null, pot, mlady ? 1 : 0);
    return rows('SELECT * FROM mz_hrac ORDER BY id DESC LIMIT 1')[0];
  };

  // --- tréningové body a kredity z reálneho sveta
  const pripis = t => {
    if (!t) return;
    let tren = 0;
    const p = rows('SELECT data FROM profil WHERE mn=?', normMn(t.meno))[0];
    if (p) { try { for (const m of JSON.parse(p.data).mesiace || []) tren += (m.t || 0); } catch (e) {} }
    const kv = rows('SELECT COALESCE(SUM(s),0) AS s FROM kq_dni WHERE meno=? AND den>=?', t.meno, t.kviz_od || '2000-01-01')[0].s;
    const dtb = Math.max(0, tren - (t.tb_tren || 0)) * TB_TRENING, dkr = Math.max(0, kv - (t.kviz_kr || 0));
    if (dtb || dkr || tren < (t.tb_tren || 0)) sql('UPDATE mz_tim SET tb=tb+?, tb_tren=?, kredit=kredit+?, kviz_kr=? WHERE meno=?', dtb, Math.max(tren, t.tb_tren || 0), dkr, kv, t.meno);
  };

  // --- zostava, taktika, striedania
  const fitF = (h, p) => h.post === p ? 1 : (p === 'B' || h.post === 'B') ? 0.35 : 0.75;
  const auto = (H, form) => {
    const [o, s, u] = FORM[form] || FORM['4-4-2'], vol = H.filter(h => !h.zran && !h.trest), used = new Set(), slot = [];
    const val = (h, p) => (p === 'B' ? A(h, 'obrana') : p === 'O' ? A(h, 'obrana') : p === 'S' ? (A(h, 'utok') + A(h, 'obrana') + A(h, 'technika')) / 3 : A(h, 'utok')) * fitF(h, p) * (1 - h.unava / 220);
    for (const [p, n] of [['B', 1], ['O', o], ['S', s], ['U', u]]) for (let i = 0; i < n; i++) {
      const c = vol.filter(h => !used.has(h.id)).sort((a, b) => val(b, p) - val(a, p))[0];
      if (c) { used.add(c.id); slot.push(c.id); }
    }
    return slot;
  };
  const zostava = t => {
    const H = hraci(t.meno), form = FORM[t.form] ? t.form : '4-4-2';
    let ids = J(t.zostava, []);
    const by = new Map(H.map(h => [h.id, h]));
    if (ids.length !== 11 || new Set(ids).size !== 11 || ids.some(id => !by.has(id) || by.get(id).zran || by.get(id).trest)) ids = auto(H, form);
    const [o, s] = FORM[form], posty = ['B', ...Array(o).fill('O'), ...Array(s).fill('S'), ...Array(11 - 1 - o - s).fill('U')];
    const hr = ids.map((id, i) => ({ h: by.get(id), p: posty[i] })).filter(x => x.h), inn = new Set(hr.map(x => x.h.id));
    const tk = Object.assign({ presing: 'stredny', styl: 'kombinacia', pasca: false }, J(t.taktika, {}));
    return { form, takt: TAKT[t.takt] ? t.takt : 'vyrov', hraci: hr, lavicka: H.filter(h => !inn.has(h.id) && !h.zran && !h.trest), tk, str: J(t.striedania, []) };
  };

  // --- simulácia: 18 úsekov po 5 minút, zostava, únava, taktika a striedania sa menia počas zápasu
  const simuluj = (tA, tB, ostry, opt = {}) => {
    const S = { d: { t: tA, z: zostava(tA) }, h: { t: tB, z: zostava(tB) } }, ev = [], hral = { d: {}, h: {} }, xg = { d: 0, h: 0 };
    for (const k of ['d', 'h']) { const x = S[k]; x.on = x.z.hraci.map(o => ({ ...o })); x.bench = x.z.lavicka.slice(); x.subs = 0; x.g = 0; x.zlte = {}; x.done = new Set(); x.on.forEach(o => hral[k][o.h.id] = 0); }
    const opp = k => k === 'd' ? 'h' : 'd', mPo = (id, m) => Math.min(90, Math.max(m, ...ev.filter(e => e.id === id).map(e => e.m)));
    const gk = k => (S[k].on.find(o => o.p === 'B') || S[k].on[0] || { h: { meno: 'brankár', obrana: 30 } }).h;
    const sub = (x, h, k, t) => x.replace(/\{h\}/g, h).replace(/\{b\}/g, gk(opp(k)).meno).replace(/\{t\}/g, t);
    const avg = (k, a, posts) => { const L = S[k].on.filter(o => posts.includes(o.p)); return L.length ? L.reduce((s, o) => s + A(o.h, a), 0) / L.length : 45; };
    const sila = (k, m) => {
      const x = S[k], pr = PRESING[x.z.tk.presing] || PRESING.stredny;
      let att = 0, def = 0;
      for (const { h, p } of x.on) {
        const un = h.unava + m * (0.33 - A(h, 'kond') / 400) * pr.u, ef = fitF(h, p) * (1 - cl(un, 0, 100) / 250) * (1 + ((h.forma || 50) - 50) / 250);
        if (p === 'B') def += A(h, 'obrana') * 1.5 * ef;
        if (p === 'O') { def += A(h, 'obrana') * ef; att += A(h, 'utok') * 0.2 * ef; }
        if (p === 'S') { def += A(h, 'obrana') * 0.5 * ef; att += (A(h, 'utok') * 0.45 + A(h, 'technika') * 0.15) * ef; }
        if (p === 'U') { att += A(h, 'utok') * ef; def += A(h, 'obrana') * 0.15 * ef; }
      }
      const [ta, td] = TAKT[x.z.takt]; att *= ta * pr.a * 1.44; def *= td * pr.d;
      att *= 1 + (avg(k, STYL[x.z.tk.styl] || 'technika', ['S', 'U']) - 50) / 250;
      if (x.z.tk.pasca) def *= avg(opp(k), 'rychlost', ['U']) >= 60 ? 0.94 : 1.06;
      if (x.z.tk.kap && x.on.some(o => o.h.id === x.z.tk.kap)) { att *= 1.02; def *= 1.02; }
      const diff = x.g - S[opp(k)].g;
      if (m >= 70 && diff < 0) { att *= 1.12; def *= 0.93; }
      if (m >= 75 && diff > 0) { att *= 0.95; def *= 1.05; }
      return { att, def };
    };
    const vahaStrelca = (k, o) => (o.p === 'U' ? 3 : o.p === 'S' ? 1.4 : o.p === 'O' ? 0.35 : 0.01) * A(o.h, 'utok') * (S[k].z.tk.styl === 'kridla' || S[k].z.tk.styl === 'protiutoky' ? A(o.h, 'rychlost') / 50 : S[k].z.tk.styl === 'dlhe' ? A(o.h, 'hlavicky') / 50 : A(o.h, 'technika') / 50);
    const vyber = (L, w) => { const W = L.map(w); let r = Math.random() * W.reduce((a, b) => a + b, 0); for (let i = 0; i < L.length; i++) { r -= W[i]; if (r <= 0) return L[i]; } return L[0]; };
    const exek = (k, kto, attr) => { const id = S[k].z.tk[kto], o = S[k].on.find(x => x.h.id === id && x.p !== 'B'); return o ? o.h : (S[k].on.filter(x => x.p !== 'B').sort((a, b) => A(b.h, attr) - A(a.h, attr))[0] || S[k].on[0]).h; };
    const von = (k, h, m) => { S[k].on = S[k].on.filter(o => o.h.id !== h.id); hral[k][h.id] = (hral[k][h.id] || 0); };
    const striedaj = (k, m, vonH, dnuH, txt) => {
      const x = S[k], o = x.on.find(q => q.h.id === vonH.id); if (!o || x.subs >= 5) return false;
      o.h = dnuH; x.bench = x.bench.filter(b => b.id !== dnuH.id); x.subs++; hral[k][dnuH.id] = hral[k][dnuH.id] || 0;
      ev.push({ m, t: 'stried', s: k, h: dnuH.meno, id: dnuH.id, von: vonH.meno, txt }); return true;
    };
    const STYL_GOL = { kombinacia: ['po krásnej kombinácii', 'dorážkou', 'po prihrávke do uličky', 'technickou strelou k žrdi'], kridla: ['po centri z krídla', 'po samostatnom nájazde', 'z rýchleho úniku po krídle'], dlhe: ['po dlhej lopte', 'hlavou po dlhom nákope', 'po zrazenej lopte'], protiutoky: ['z rýchleho protiútoku', 'po brejku cez celé ihrisko', 'po zachytenej prihrávke'] };
    ev.push({ m: 1, t: 'kom', s: 'n', txt: 'Rozhodca pískol, zápas sa začína!' });
    for (let seg = 0; seg < 18; seg++) {
      const m0 = seg * 5 + 1;
      if (seg === 9) ev.push({ m: 45, t: 'kom', s: 'n', txt: 'Polčas. V šatni sa podáva čaj a výčitky.' });
      // pripravené striedania
      for (const k of ['d', 'h']) {
        const x = S[k], diff = x.g - S[opp(k)].g;
        (x.z.str || []).forEach((r, i) => {
          if (x.done.has(i) || m0 < (+r.min || 60)) return;
          const ok = r.ak === 'vzdy' || (r.ak === 'prehravame' && diff < 0) || (r.ak === 'remiza' && diff === 0) || (r.ak === 'vyhravame' && diff > 0);
          x.done.add(i); if (!ok) return;
          const v = x.on.find(o => o.h.id === +r.von), d = x.bench.find(b => b.id === +r.dnu);
          if (v && d) striedaj(k, m0, v.h, d, 'plánované striedanie');
        });
        // unavení po 65. minúte – automaticky, ak má tréner voľné striedania a nič nenaplánoval
        if (m0 >= 66 && x.subs < 3 && !(x.z.str || []).length) {
          const un = x.on.filter(o => o.p !== 'B').map(o => ({ o, u: o.h.unava + m0 * (0.33 - A(o.h, 'kond') / 400) })).sort((a, b) => b.u - a.u)[0];
          const nah = un && x.bench.filter(b => b.post === un.o.p).sort((a, b) => ovr(b) - ovr(a))[0];
          if (un && un.u > 45 && nah && Math.random() < 0.5) striedaj(k, m0, un.o.h, nah, 'unavený hráč ide von');
        }
      }
      for (const k of ['d', 'h']) {
        const x = S[k], o2 = opp(k), sa = sila(k, m0), so = sila(o2, m0);
        const l = cl(1.3 * Math.pow(sa.att / Math.max(1, so.def), 1.25) * (k === 'd' ? 1.08 : 0.95), 0.12, 4.5) * (x.on.length / 11) / 18;
        xg[k] += l;
        for (let i = poisson(l); i > 0; i--) {
          const m = m0 + rnd(5), r = Math.random(), polia = x.on.filter(o => o.p !== 'B'); if (!polia.length) break;
          if (r < 0.08) {
            const h = exek(k, 'pen', 'nervy'), p = 0.62 + (A(h, 'nervy') - 50) / 200 - (A(gk(o2), 'obrana') - 50) / 400;
            if (Math.random() < p) { x.g++; ev.push({ m, t: 'gol', s: k, h: h.meno, id: h.id, ako: 'z penalty', txt: Math.random() < 0.5 ? ch(K_GOL) : '' }); }
            else ev.push({ m, t: 'sanca', s: k, h: h.meno, id: h.id, txt: `${h.meno} kope penaltu… ${gk(o2).meno} ju chytil! Nervy nevydržali.` });
          } else if (r < 0.2) {
            const roh = exek(k, 'roh', 'technika'), h = vyber(polia, o => A(o.h, 'hlavicky') * (o.p === 'U' ? 1.4 : o.p === 'O' ? 1.1 : 0.8)).h;
            x.g++; ev.push({ m, t: 'gol', s: k, h: h.meno, id: h.id, ako: 'hlavou po rohu' + (roh.id !== h.id ? ' (rohový kop: ' + roh.meno + ')' : ''), txt: Math.random() < 0.5 ? ch(K_GOL) : '' });
          } else if (r < 0.26) {
            const h = exek(k, 'pk', 'technika');
            if (Math.random() < A(h, 'technika') / 120) { x.g++; ev.push({ m, t: 'gol', s: k, h: h.meno, id: h.id, ako: 'z priameho kopu', txt: Math.random() < 0.5 ? ch(K_GOL) : '' }); }
            else ev.push({ m, t: 'sanca', s: k, h: h.meno, id: h.id, txt: `Priamy kop: ${h.meno} mieri do šibenice… tesne nad.` });
          } else {
            const h = vyber(polia, o => vahaStrelca(k, o)).h;
            x.g++; ev.push({ m, t: 'gol', s: k, h: h.meno, id: h.id, ako: ch(STYL_GOL[x.z.tk.styl] || STYL_GOL.kombinacia), txt: Math.random() < 0.55 ? ch(K_GOL) : '' });
          }
        }
        for (let i = poisson(l * 1.7 + 0.07); i > 0; i--) { const L = x.on.filter(o => o.p !== 'B'); if (!L.length) break; const h = vyber(L, o => vahaStrelca(k, o)).h; ev.push({ m: m0 + rnd(5), t: 'sanca', s: k, h: h.meno, id: h.id, txt: sub(ch(K_SANCA), h.meno, k, '') }); }
        // karty a zranenia
        const fauly = (PRESING[x.z.tk.presing] || PRESING.stredny).f;
        for (let i = poisson(0.075 * fauly); i > 0; i--) {
          const o = ch(x.on); if (!o) break; const h = o.h, m = mPo(h.id, m0 + rnd(5));
          x.zlte[h.id] = (x.zlte[h.id] || 0) + 1;
          ev.push({ m, t: 'zk', s: k, h: h.meno, id: h.id, txt: ch(K_ZK) });
          if (x.zlte[h.id] === 2) { ev.push({ m, t: 'ck', s: k, h: h.meno, id: h.id, txt: 'druhá žltá karta' }); vylucenie(k, h, m); }
        }
        if (Math.random() < 0.003 * fauly) { const o = ch(x.on.filter(q => q.p !== 'B')); if (o) { const m = mPo(o.h.id, m0 + rnd(5)); ev.push({ m, t: 'ck', s: k, h: o.h.meno, id: o.h.id, txt: 'priama červená za surový zákrok' }); vylucenie(k, o.h, m); } }
        if (ostry) for (const o of x.on.slice()) if (Math.random() < 0.0014) {
          const m = mPo(o.h.id, m0 + rnd(5)), kk = 1 + rnd(3); ev.push({ m, t: 'zran', s: k, h: o.h.meno, id: o.h.id, k: kk, txt: ch(K_ZRAN) });
          const nah = x.bench.filter(b => b.post === o.p).sort((a, b) => ovr(b) - ovr(a))[0] || x.bench.filter(b => b.post !== 'B')[0];
          if (!(nah && striedaj(k, m, o.h, nah, 'za zraneného'))) von(k, o.h, m);
        }
      }
      if (Math.random() < 0.28) { const k = rnd(2) ? 'd' : 'h'; ev.push({ m: m0 + rnd(5), t: 'kom', s: 'n', txt: sub(ch(K_KOM), '', k, S[k].t.nazov) }); }
      for (const k of ['d', 'h']) for (const o of S[k].on) hral[k][o.h.id] = (hral[k][o.h.id] || 0) + 5;
    }
    function vylucenie(k, h, m) {
      const x = S[k], o = x.on.find(q => q.h.id === h.id); if (!o) return;
      x.on = x.on.filter(q => q.h.id !== h.id);
      if (o.p === 'B') { // brankár vylúčený: do bránky ide náhradný brankár alebo hráč z poľa
        const nb = x.bench.find(b => b.post === 'B');
        if (nb && x.subs < 5) { const obet = x.on.filter(q => q.p === 'U' || q.p === 'S').sort((a, b) => ovr(a.h) - ovr(b.h))[0]; if (obet) { obet.h = nb; obet.p = 'B'; x.bench = x.bench.filter(b => b.id !== nb.id); x.subs++; hral[k][nb.id] = 0; ev.push({ m, t: 'stried', s: k, h: nb.meno, id: nb.id, von: '', txt: 'náhradný brankár za vylúčeného' }); } }
        else { const q = x.on.find(q => q.p === 'O') || x.on[0]; if (q) q.p = 'B'; }
      }
    }
    ev.push({ m: 90, t: 'kom', s: 'n', txt: 'Koniec zápasu!' });
    let pen = null;
    if (opt.vyrazka && S.d.g === S.h.g) {
      const strelci = k => S[k].on.filter(o => o.p !== 'B').map(o => o.h).sort((a, b) => A(b, 'nervy') - A(a, 'nervy'));
      const kop = (k, i) => { const L = strelci(k), h = L[i % Math.max(1, L.length)] || gk(k); return Math.random() < 0.72 + (A(h, 'nervy') - 50) / 200 - (A(gk(opp(k)), 'obrana') - 50) / 400; };
      let a = 0, b = 0, i = 0;
      for (; i < 5; i++) { if (kop('d', i)) a++; if (kop('h', i)) b++; }
      while (a === b && i < 30) { const x = kop('d', i), y = kop('h', i); a += x; b += y; i++; }
      pen = [a, b]; ev.push({ m: 90, t: 'kom', s: 'n', txt: `Penaltový rozstrel ${a}:${b} – postupuje ${a > b ? S.d.t.nazov : S.h.t.nazov}!` });
    }
    const por = e => e.txt === 'Koniec zápasu!' ? 2 : e.txt && e.txt.startsWith('Penaltový') ? 3 : e.txt === 'Rozhodca pískol, zápas sa začína!' ? -1 : e.t === 'kom' && e.m === 45 ? 1 : 0;
    ev.sort((a, b) => a.m - b.m || por(a) - por(b));
    const mena = k => S[k].z.hraci.map(o => o.h.meno).concat(ev.filter(e => e.t === 'stried' && e.s === k).map(e => '↑ ' + e.h));
    return { gA: S.d.g, gB: S.h.g, ev, pen, hralA: hral.d, hralB: hral.h, xg: [Math.round(xg.d * 10) / 10, Math.round(xg.h * 10) / 10], zd: mena('d'), zh: mena('h') };
  };

  // --- po zápase: únava, forma, zranenia, tresty, štatistiky, peniaze
  const poZapase = (t, hral, g, gs, ev, s, z) => {
    const vyhra = g > gs, rem = g === gs, liga = z.typ === 'liga', domaci = s === 'd';
    for (const h of hraci(t.meno)) {
      const min = hral[h.id];
      const un = min != null ? cl(h.unava + Math.round(Math.max(6, 20 - Math.round(A(h, 'kond') / 6)) * Math.max(0.3, min / 90)), 0, 100) : cl(h.unava - 25, 0, 100);
      const fo = cl((h.forma || 50) + rnd(9) - 4 + (min != null ? (vyhra ? 3 : rem ? 0 : -3) : -1), 25, 85);
      const zre = ev.find(e => e.t === 'zran' && e.id === h.id), zr = zre ? zre.k : Math.max(0, h.zran - 1);
      const tr = ev.some(e => e.t === 'ck' && e.id === h.id) ? 1 : Math.max(0, (h.trest || 0) - 1);
      const gl = ev.filter(e => e.t === 'gol' && e.id === h.id).length;
      sql('UPDATE mz_hrac SET unava=?, forma=?, zran=?, trest=?, goly=goly+?, zapasy=zapasy+? WHERE id=?', un, fo, zr, tr, gl, min != null ? 1 : 0, h.id);
      if (min != null || gl) sql('INSERT INTO mz_stat (sez, hid, meno, tim, goly, zapasy) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (sez, hid) DO UPDATE SET goly=goly+excluded.goly, zapasy=zapasy+excluded.zapasy, tim=excluded.tim', z.sez, h.id, h.meno, t.meno, gl, min != null ? 1 : 0);
    }
    let kr = (vyhra ? 300 : rem ? 150 : 60) + 20 * g, info = [];
    if (domaci) { const st = STADION[(t.stadion || 1) - 1] || STADION[0], div = Math.min(st.kap, t.fans || 100), vst = Math.round(div * (t.vstupne || 2) * (z.typ === 'liga' ? 1 : 1.5)); kr += vst; info.push(`vstupné +${vst} (${div} divákov)`); }
    if (liga) { const pl = hraci(t.meno).reduce((a, h) => a + plat(h), 0); kr -= pl; info.push(`platy −${pl}`); }
    const fans = cl(Math.round((t.fans || 100) + (vyhra ? 8 : rem ? 2 : -5) - ((t.vstupne || 2) - 2) * 2 + rnd(5) - 2), 30, 5000);
    sql('UPDATE mz_tim SET kredit=kredit+?, tb=tb+?, fans=? WHERE meno=?', kr, TB_KOLO, fans, t.meno);
    const pen = J(z.pen, null), pp = pen ? (s === 'd' ? pen : [pen[1], pen[0]]) : null;
    log(t.meno, `${z.typ === 'pohar' ? 'Pohár' : z.typ === 'super' ? 'Superpohár' : z.kolo + '. kolo'}: ${vyhra ? 'výhra' : rem ? (pp ? (pp[0] > pp[1] ? 'postup na penalty' : 'vypadnutie na penalty') : 'remíza') : 'prehra'} ${g}:${gs}${pp ? ` (pk ${pp[0]}:${pp[1]})` : ''}, ${info.concat([`výsledok +${(vyhra ? 300 : rem ? 150 : 60) + 20 * g}`]).join(', ')} → spolu ${kr >= 0 ? '+' : ''}${kr} kreditov`);
  };

  // --- sezóna
  const aktSez = () => rows('SELECT * FROM mz_sez ORDER BY id DESC LIMIT 1')[0];
  const rr = T0 => { // každý s každým dvakrát: doma a vonku
    const T = T0.slice(); if (T.length % 2) T.push(null);
    const R1 = []; for (let k = 0; k < T.length - 1; k++) { const kolo = []; for (let i = 0; i < T.length / 2; i++) { const a = T[i], b = T[T.length - 1 - i]; if (a && b) kolo.push(k % 2 ? [b, a] : [a, b]); } R1.push(kolo); T.splice(1, 0, T.pop()); }
    const R = R1.concat(R1.map(k => k.map(([a, b]) => [b, a])));
    return R;
  };
  const vlozZapas = (s, typ, kolo, a, b, r, den, hod, div) => {
    sql('INSERT INTO mz_zapas (sez, kolo, dom, hos, gd, gh, udalosti, den, hotovo, typ, hod, div, pen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)', s.id, kolo, a, b, r.gA, r.gB,
      JSON.stringify({ ev: r.ev, xg: r.xg, zd: r.zd, zh: r.zh, hd: r.hralA, hh: r.hralB }), den, typ, hod, div || 1, r.pen ? JSON.stringify(r.pen) : null);
  };
  const vitaz = z => z.gd > z.gh ? z.dom : z.gh > z.gd ? z.hos : (J(z.pen, [0, 0])[0] > J(z.pen, [0, 0])[1] ? z.dom : z.hos);
  const zaciatok = s => {
    const timy = rows('SELECT meno FROM mz_tim').map(r => r.meno);
    if (timy.length < 2) return s;
    const prev = rows('SELECT * FROM mz_sez WHERE id<? AND archiv IS NOT NULL ORDER BY id DESC LIMIT 1', s.id)[0], pa = prev ? J(prev.archiv, {}) : {};
    const poradie = (pa.poradie || []).filter(m => timy.includes(m)).concat(shuffle(timy.filter(m => !(pa.poradie || []).includes(m))));
    const div = poradie.length > DIV_LIMIT ? [poradie.slice(0, Math.ceil(poradie.length / 2)), poradie.slice(Math.ceil(poradie.length / 2))] : [poradie];
    const Rd = div.map(d => rr(shuffle(d.slice()))), n = Math.max(...Rd.map(R => R.length)), roz = [];
    for (let k = 0; k < n; k++) roz.push(Rd.flatMap((R, i) => (R[k] || []).map(([a, b]) => [a, b, i + 1])));
    // liga trvá aspoň LIGA_DNI dní: pri menej kolách sú medzi nimi voľné dni, pri viac kolách sa hrá každý deň
    const D = Math.max(LIGA_DNI, n), dni = [...Array(n)].map((_, k) => Math.floor(k * D / n));
    // superpohár: majster a víťaz pohára minulej sezóny
    let sup = null;
    if (pa.majster && pa.pohar && pa.majster !== pa.pohar && timy.includes(pa.majster) && timy.includes(pa.pohar)) sup = { den: s.start, a: pa.majster, b: pa.pohar };
    sql('UPDATE mz_sez SET n=?, timy=?, rozpis=?, divizie=?, pohar=NULL, super=?, dni=? WHERE id=?', n, JSON.stringify(timy), JSON.stringify(roz), JSON.stringify(div), sup ? JSON.stringify(sup) : null, JSON.stringify(dni), s.id);
    // dorast: každý tím dostane 1 – 2 mladíkov
    for (const m of timy) { const pocet = 1 + rnd(2); for (let i = 0; i < pocet && hraci(m).length < MAX_KADER; i++) { const h = novyHrac(ch(['O', 'S', 'S', 'U', 'B', 'O', 'U']), 36 + rnd(10), m, null, 16 + rnd(3), true); log(m, `Z dorastu prišiel ${h.meno} (${POSTY[h.post]}, ${h.vek} r.)${h.potencial >= 75 ? ' – veľký talent!' : ''}`); } }
    return aktSez();
  };
  const koniecSezony = s => {
    const div = J(s.divizie, [JSON.parse(s.timy)]), tab = div.map((_, i) => tabulka(s, i + 1)), pg = J(s.pohar, {});
    let por = [];
    if (tab.length === 2) { const a = tab[0].map(x => x.meno), b = tab[1].map(x => x.meno), p = Math.min(POSTUP, a.length - 1, b.length); por = a.slice(0, a.length - p).concat(b.slice(0, p), a.slice(a.length - p), b.slice(p)); }
    else por = tab[0].map(x => x.meno);
    const st = rows('SELECT meno, tim, goly FROM mz_stat WHERE sez=? ORDER BY goly DESC LIMIT 1', s.id)[0];
    const arch = { majster: tab[0][0] && tab[0][0].meno, majster2: tab[1] && tab[1][0] && tab[1][0].meno, pohar: pg.vitaz, strelec: st ? { meno: st.meno, tim: st.tim, goly: st.goly } : null, poradie: por, postup: tab.length === 2 ? tab[1].slice(0, POSTUP).map(x => x.meno) : [], zostup: tab.length === 2 ? tab[0].slice(-POSTUP).map(x => x.meno) : [] };
    sql('UPDATE mz_sez SET majster=?, archiv=? WHERE id=?', arch.majster || null, JSON.stringify(arch), s.id);
    if (arch.majster) log(arch.majster, `🏆 Majster sezóny ${s.id}!`);
    if (arch.pohar) log(arch.pohar, `🏆 Víťaz pohára v sezóne ${s.id}!`);
    // starnutie: mladí rastú k potenciálu, starší slabnú, veteráni končia
    for (const h of rows('SELECT * FROM mz_hrac WHERE tim IS NOT NULL')) {
      const v = (h.vek || 25) + 1, zmeny = {};
      for (const a of ATTR) {
        let d = 0;
        if (v <= 21) d = h.potencial > ovr(h) ? 1 + rnd(4) : rnd(2);
        else if (v <= 24) d = h.potencial > ovr(h) ? rnd(3) : rnd(2);
        else if (v <= 29) d = rnd(3) - 1;
        else if (v <= 32) d = -rnd(3) + (a === 'nervy' ? 1 : 0);
        else d = -1 - rnd(3) + (a === 'nervy' ? 1 : 0);
        if (a === 'rychlost' && v >= 30) d -= 1;
        zmeny[a] = cl(A(h, a) + d, 10, 99);
      }
      if ((v >= 35 && Math.random() < 0.5) || v >= 38) { sql('DELETE FROM mz_hrac WHERE id=?', h.id); log(h.tim, `${h.meno} (${v} r.) ukončil kariéru. Ďakujeme!`); continue; }
      sql(`UPDATE mz_hrac SET vek=?, ${ATTR.map(a => a + '=?').join(', ')}, forma=50 WHERE id=?`, v, ...ATTR.map(a => zmeny[a]), h.id);
    }
    for (const m of rows('SELECT meno FROM mz_tim').map(r => r.meno)) while (hraci(m).length < MIN_KADER) { const h = novyHrac(ch(['O', 'S', 'U']), 38 + rnd(8), m, null, 17 + rnd(2), true); log(m, `Káder doplnil dorastenec ${h.meno}.`); }
  };
  const dohraj = () => {
    let s = aktSez();
    const timy = rows('SELECT meno FROM mz_tim').map(r => r.meno);
    if (!s && timy.length >= 2) { const st = plusDni(now.den, 2); sql('INSERT INTO mz_sez (start, n) VALUES (?, 0)', st > LIGA_START ? st : LIGA_START); s = aktSez(); }
    else if (s && s.rozpis && s.archiv) { sql('INSERT INTO mz_sez (start, n) VALUES (?, 0)', plusDni(now.den, 1)); s = aktSez(); }
    if (!s) return null;
    if (!s.rozpis) { if (!nadosah(s.start, POHAR_HOD)) return s; s = zaciatok(s); if (!s.rozpis) return s; }
    // superpohár
    const sup = J(s.super, null);
    if (sup && !sup.hotovy && nadosah(sup.den, POHAR_HOD)) {
      const a = tim(sup.a), b = tim(sup.b);
      if (a && b) { const r = simuluj(a, b, true, { vyrazka: true }); vlozZapas(s, 'super', 0, a.meno, b.meno, r, sup.den, POHAR_HOD, 1); }
      sup.hotovy = true; sql('UPDATE mz_sez SET super=? WHERE id=?', JSON.stringify(sup), s.id);
    }
    // ligové kolá
    const roz = JSON.parse(s.rozpis);
    while (s.odohrane < s.n) {
      const k = s.odohrane + 1, den = denKola(s, k);
      if (!nadosah(den, KOLO_HOD)) break;
      for (const [a, b, d] of roz[k - 1]) { const tA = tim(a), tB = tim(b); if (!tA || !tB) continue; vlozZapas(s, 'liga', k, a, b, simuluj(tA, tB, true), den, KOLO_HOD, d); }
      sql('UPDATE mz_sez SET odohrane=? WHERE id=?', k, s.id); s = aktSez();
    }
    poZapasoch(s);
    // pohár: po skončení ligy horná polovica tabuľky 1. ligy (najviac POHAR_MAX), nasadení podľa poradia, kolá každý deň o 20:00
    if (s.odohrane >= s.n && !s.pohar && !rows("SELECT 1 FROM mz_zapas WHERE sez=? AND vyzva=0 AND hotovo=0 AND typ='liga'", s.id).length) {
      const q = tabulka(s, 1).slice(0, Math.min(POHAR_MAX, Math.floor(J(s.divizie, [[]])[0].length / 2))).map(x => x.meno);
      let pg0 = { K: 0, kola: [], vitaz: null, timy: q };
      if (q.length >= 2) {
        const P = 2 ** Math.ceil(Math.log2(q.length)), K = Math.log2(P);
        let ord = [1]; while (ord.length < P) { const m = ord.length * 2 + 1; ord = ord.flatMap(x => [x, m - x]); }
        const pary = []; for (let i = 0; i < P; i += 2) pary.push([q[ord[i] - 1] || null, q[ord[i + 1] - 1] || null]);
        const start = plusDni(denKola(s, s.n), 1); // deň po poslednom ligovom kole
        pg0 = { K, kola: [...Array(K)].map((_, r) => ({ den: plusDni(start, r), pary: r === 0 ? pary : null })), vitaz: null, timy: q };
      }
      sql('UPDATE mz_sez SET pohar=? WHERE id=?', JSON.stringify(pg0), s.id); s = aktSez();
    }
    const pg = J(s.pohar, null);
    if (pg) {
      let zmena = false;
      for (let r = 0; r < pg.K; r++) {
        const kolo = pg.kola[r];
        if (kolo.hotove) continue;
        if (!kolo.pary) { const prev = pg.kola[r - 1]; if (!prev || !prev.hotove) break; const w = prev.vitazi; kolo.pary = []; for (let i = 0; i < w.length; i += 2) kolo.pary.push([w[i], w[i + 1] || null]); zmena = true; }
        if (!nadosah(kolo.den, KOLO_HOD)) break;
        kolo.vitazi = [];
        for (const [a, b] of kolo.pary) {
          const tA = a && tim(a), tB = b && tim(b);
          if (!tA || !tB) { kolo.vitazi.push(tA ? a : tB ? b : null); continue; }
          const r2 = simuluj(tA, tB, true, { vyrazka: true });
          vlozZapas(s, 'pohar', r + 1, a, b, r2, kolo.den, KOLO_HOD, 1);
          kolo.vitazi.push(vitaz({ dom: a, hos: b, gd: r2.gA, gh: r2.gB, pen: r2.pen ? JSON.stringify(r2.pen) : null }));
        }
        kolo.vitazi = kolo.vitazi.filter((x, i, L) => x !== null || L.length === 1);
        kolo.hotove = true; zmena = true;
        if (r === pg.K - 1) pg.vitaz = kolo.vitazi[0] || null;
      }
      if (zmena) { sql('UPDATE mz_sez SET pohar=? WHERE id=?', JSON.stringify(pg), s.id); s = aktSez(); }
    }
    poZapasoch(s);
    const pg2 = J(s.pohar, null);
    if (s.odohrane >= s.n && !s.archiv && pg2 && pg2.kola.every(k => k.hotove) && !rows('SELECT 1 FROM mz_zapas WHERE sez=? AND vyzva=0 AND hotovo=0', s.id).length) { koniecSezony(s); s = aktSez(); }
    return s;
  };
  const poZapasoch = s => { // po skončení živého prenosu sa pripíšu následky
    for (const z of rows('SELECT * FROM mz_zapas WHERE sez=? AND vyzva=0 AND hotovo=0', s.id)) {
      if (!skoncene(z.den, z.hod || KOLO_HOD)) continue;
      const u = JSON.parse(z.udalosti), tA = tim(z.dom), tB = tim(z.hos);
      const hd = u.hd || Object.fromEntries((u.zdi || []).map(id => [id, 90])), hh = u.hh || Object.fromEntries((u.zhi || []).map(id => [id, 90]));
      if (tA) poZapase(tA, hd, z.gd, z.gh, u.ev, 'd', z);
      if (tB) poZapase(tB, hh, z.gh, z.gd, u.ev, 'h', z);
      sql('UPDATE mz_zapas SET hotovo=1 WHERE id=?', z.id);
    }
  };
  const denKola = (s, k) => { const d = J(s.dni, null); return plusDni(s.start, d && d[k - 1] != null ? d[k - 1] : k - 1); };
  const tabulka = (s, div = 1) => {
    const D = J(s.divizie, null), cl2 = D ? D[div - 1] || [] : JSON.parse(s.timy), T = {};
    for (const m of cl2) { const t = tim(m); if (!t) continue; T[m] = { meno: m, nazov: t.nazov, erb: t.erb, f1: t.f1, f2: t.f2, z: 0, v: 0, r: 0, p: 0, gs: 0, gi: 0, b: 0, forma: [] }; }
    for (const z of rows("SELECT dom, hos, gd, gh FROM mz_zapas WHERE sez=? AND vyzva=0 AND hotovo=1 AND COALESCE(typ,'liga')='liga' ORDER BY kolo", s.id)) {
      for (const [m, g, gi] of [[z.dom, z.gd, z.gh], [z.hos, z.gh, z.gd]]) { const x = T[m]; if (!x) continue; x.z++; x.gs += g; x.gi += gi; if (g > gi) { x.v++; x.b += 3; x.forma.push('V'); } else if (g === gi) { x.r++; x.b++; x.forma.push('R'); } else { x.p++; x.forma.push('P'); } }
    }
    return Object.values(T).map(x => ({ ...x, forma: x.forma.slice(-5) })).sort((a, b) => b.b - a.b || (b.gs - b.gi) - (a.gs - a.gi) || b.gs - a.gs || a.nazov.localeCompare(b.nazov));
  };
  const trh = () => {
    if (!rows('SELECT 1 FROM mz_hrac WHERE tim IS NULL AND trh_den=?', now.den).length) {
      sql('DELETE FROM mz_hrac WHERE tim IS NULL');
      for (let i = 0; i < 14; i++) novyHrac(ch(['B', 'O', 'O', 'S', 'S', 'S', 'U', 'U']), 38 + rnd(30), null, now.den);
    }
    return rows('SELECT * FROM mz_hrac WHERE tim IS NULL ORDER BY id').map(h => ({ ...h, ovr: ovr(h), cena: cena(h), plat: plat(h) }));
  };
  const zivo = z => { // priebežný stav zápasu, ktorý sa práve „hrá“
    const lm = z.vyzva ? vyzMin(z.t0) : z.hotovo ? null : liveMin(z.den, z.hod || KOLO_HOD);
    const o = { id: z.id, kolo: z.kolo, typ: z.typ || 'liga', div: z.div || 1, dom: z.dom, hos: z.hos, gd: z.gd, gh: z.gh, den: z.den, hod: z.hod || KOLO_HOD, pen: lm == null ? J(z.pen, null) : null };
    if (lm != null) { const ev = J(z.udalosti, { ev: [] }).ev.filter(e => e.t === 'gol' && e.m <= lm); o.gd = ev.filter(e => e.s === 'd').length; o.gh = ev.filter(e => e.s === 'h').length; o.live = lm; }
    else if (!z.vyzva && !z.hotovo && !skoncene(z.den, z.hod || KOLO_HOD)) { o.gd = null; o.gh = null; }
    return o;
  };

  // ===== požiadavky =====
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
    const p = rows('SELECT data FROM profil WHERE mn=?', normMn(meno))[0]; let tren = 0;
    if (p) { try { for (const m of JSON.parse(p.data).mesiace || []) tren += (m.t || 0); } catch (e) {} }
    sql('UPDATE mz_tim SET tb_tren=? WHERE meno=?', tren, meno);
    log(meno, `Založený klub ${nazov}. Veľa šťastia!`);
  }
  const s = dohraj();
  const t = tim(meno);
  if (t) pripis(t);
  const moj = id => rows('SELECT * FROM mz_hrac WHERE id=? AND tim=?', Number(id), meno)[0];

  if (path === '/mz/upravit' && t) {
    const col = c => /^#[0-9a-f]{6}$/i.test(c) ? c : null;
    sql('UPDATE mz_tim SET erb=?, f1=COALESCE(?, f1), f2=COALESCE(?, f2) WHERE meno=?', String(body.erb || t.erb || '⚽').slice(0, 4), col(body.f1), col(body.f2), meno);
  }
  if (path === '/mz/zmaz' && t) {
    sql('DELETE FROM mz_hrac WHERE tim=?', meno); sql('DELETE FROM mz_tim WHERE meno=?', meno); sql("UPDATE mz_ponuka SET stav='zrusena' WHERE stav='caka' AND (kupec=? OR predajca=?)", meno, meno);
    return out({ zmazany: true });
  }
  if (path === '/mz/zostava' && t) {
    const form = FORM[body.form] ? body.form : t.form, takt = TAKT[body.takt] ? body.takt : t.takt;
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).slice(0, 11) : [];
    const moji = new Set(hraci(meno).filter(h => !h.zran && !h.trest).map(h => h.id));
    sql('UPDATE mz_tim SET form=?, takt=?, zostava=? WHERE meno=?', form, takt, JSON.stringify(ids.length === 11 && ids.every(i => moji.has(i)) && new Set(ids).size === 11 ? ids : []), meno);
  }
  if (path === '/mz/taktika' && t) {
    const ids = new Set(hraci(meno).map(h => h.id)), id = v => ids.has(Number(v)) ? Number(v) : null;
    const tk = { presing: PRESING[body.presing] ? body.presing : 'stredny', styl: STYL[body.styl] ? body.styl : 'kombinacia', pasca: !!body.pasca, kap: id(body.kap), pen: id(body.pen), roh: id(body.roh), pk: id(body.pk) };
    sql('UPDATE mz_tim SET taktika=? WHERE meno=?', JSON.stringify(tk), meno);
  }
  if (path === '/mz/striedania' && t) {
    const ids = new Set(hraci(meno).map(h => h.id)), L = (Array.isArray(body.str) ? body.str : []).slice(0, 5)
      .map(r => ({ min: cl(Math.round(+r.min || 60), 1, 89), ak: ['vzdy', 'prehravame', 'remiza', 'vyhravame'].includes(r.ak) ? r.ak : 'vzdy', von: +r.von, dnu: +r.dnu }))
      .filter(r => ids.has(r.von) && ids.has(r.dnu) && r.von !== r.dnu);
    sql('UPDATE mz_tim SET striedania=? WHERE meno=?', JSON.stringify(L), meno);
  }
  if (path === '/mz/trening' && t) {
    const h = moj(body.id), a = ATTR.includes(body.attr) ? body.attr : null;
    if (!h || !a) return err('Zlé údaje.');
    if (A(h, a) >= 99) return err('Tento hráč je už na maxime.');
    const c = tbCena(A(h, a)), tt = tim(meno);
    if (tt.tb < c) return err(`Treba ${c} TB, máš ${tt.tb}.`);
    sql(`UPDATE mz_hrac SET ${a}=COALESCE(${a},45)+1 WHERE id=?`, h.id); sql('UPDATE mz_tim SET tb=tb-? WHERE meno=?', c, meno);
  }
  if (path === '/mz/kup' && t) {
    const h = rows('SELECT * FROM mz_hrac WHERE id=? AND tim IS NULL', Number(body.id))[0];
    if (!h) return err('Hráč už nie je na trhu.');
    if (hraci(meno).length >= MAX_KADER) return err(`V kádri môžeš mať najviac ${MAX_KADER} hráčov.`);
    const c = cena(h), tt = tim(meno);
    if (tt.kredit < c) return err(`Hráč stojí ${c} kreditov, máš ${tt.kredit}.`);
    sql('UPDATE mz_hrac SET tim=?, trh_den=NULL, unava=0 WHERE id=?', meno, h.id); sql('UPDATE mz_tim SET kredit=kredit-? WHERE meno=?', c, meno);
    log(meno, `Kúpený ${h.meno} z trhu za ${c} kreditov.`);
  }
  if (path === '/mz/predaj' && t) {
    const h = moj(body.id);
    if (!h) return err('Zlé údaje.');
    if (hraci(meno).length <= MIN_KADER) return err(`V kádri musí ostať aspoň ${MIN_KADER} hráčov.`);
    if (h.post === 'B' && hraci(meno).filter(x => x.post === 'B').length <= 1) return err('Posledného brankára predať nemôžeš.');
    sql('DELETE FROM mz_hrac WHERE id=?', h.id); sql('UPDATE mz_tim SET kredit=kredit+? WHERE meno=?', Math.round(cena(h) / 2), meno);
    sql("UPDATE mz_ponuka SET stav='zrusena' WHERE hid=? AND stav='caka'", h.id);
    log(meno, `Predaný ${h.meno} na trh za ${Math.round(cena(h) / 2)} kreditov.`);
  }
  if (path === '/mz/stadion' && t) {
    const lv = t.stadion || 1, nx = STADION[lv];
    if (!nx) return err('Štadión je už na najvyššej úrovni.');
    if (t.kredit < nx.cena) return err(`Prestavba stojí ${nx.cena} kreditov, máš ${t.kredit}.`);
    sql('UPDATE mz_tim SET stadion=?, kredit=kredit-? WHERE meno=?', lv + 1, nx.cena, meno); log(meno, `Štadión rozšírený na ${nx.kap} miest (−${nx.cena} kreditov).`);
  }
  if (path === '/mz/vstupne' && t) sql('UPDATE mz_tim SET vstupne=? WHERE meno=?', cl(Math.round(+body.v || 2), 1, 5), meno);
  if (path === '/mz/ponuka' && t) {
    const h = rows('SELECT * FROM mz_hrac WHERE id=? AND tim IS NOT NULL AND tim<>?', Number(body.id), meno)[0], c = Math.round(+body.cena || 0);
    if (!h) return err('Hráč sa nenašiel.');
    if (c < 10) return err('Ponuka musí byť aspoň 10 kreditov.');
    if (t.kredit < c) return err(`Máš len ${t.kredit} kreditov.`);
    if (rows("SELECT COUNT(*) AS n FROM mz_ponuka WHERE kupec=? AND stav='caka'", meno)[0].n >= 5) return err('Naraz môžeš mať najviac 5 ponúk.');
    sql("UPDATE mz_ponuka SET stav='zrusena' WHERE hid=? AND kupec=? AND stav='caka'", h.id, meno);
    sql('INSERT INTO mz_ponuka (hid, kupec, predajca, cena, t) VALUES (?, ?, ?, ?, ?)', h.id, meno, h.tim, c, Date.now());
    log(h.tim, `${t.nazov} ponúka za ${h.meno} ${c} kreditov.`);
  }
  if (path === '/mz/ponuka_zrus' && t) sql("UPDATE mz_ponuka SET stav='zrusena' WHERE id=? AND kupec=? AND stav='caka'", Number(body.id), meno);
  if (path === '/mz/ponuka_odpoved' && t) {
    const p = rows("SELECT * FROM mz_ponuka WHERE id=? AND predajca=? AND stav='caka'", Number(body.id), meno)[0];
    if (!p) return err('Ponuka už neplatí.');
    const h = moj(p.hid), k = tim(p.kupec);
    if (!body.prijat || !h || !k) { sql("UPDATE mz_ponuka SET stav='zamietnuta' WHERE id=?", p.id); if (k && h) log(k.meno, `${t.nazov} odmietol ponuku za ${h.meno}.`); }
    else {
      if (k.kredit < p.cena) return err('Kupec už nemá dosť kreditov.');
      if (hraci(k.meno).length >= MAX_KADER) return err('Kupec má plný káder.');
      if (hraci(meno).length <= MIN_KADER) return err(`V kádri ti musí ostať aspoň ${MIN_KADER} hráčov.`);
      if (h.post === 'B' && hraci(meno).filter(x => x.post === 'B').length <= 1) return err('Posledného brankára predať nemôžeš.');
      sql('UPDATE mz_hrac SET tim=? WHERE id=?', k.meno, h.id);
      sql('UPDATE mz_tim SET kredit=kredit-? WHERE meno=?', p.cena, k.meno); sql('UPDATE mz_tim SET kredit=kredit+? WHERE meno=?', p.cena, meno);
      sql("UPDATE mz_ponuka SET stav='prijata' WHERE id=?", p.id); sql("UPDATE mz_ponuka SET stav='zrusena' WHERE hid=? AND stav='caka'", h.id);
      log(meno, `Predaný ${h.meno} do ${k.nazov} za ${p.cena} kreditov.`); log(k.meno, `Prestup: ${h.meno} prichádza z ${t.nazov} za ${p.cena} kreditov.`);
    }
  }
  if (path === '/mz/klub') {
    const k = tim(String(body.klub || ''));
    if (!k) return err('Klub sa nenašiel.', 404);
    return out({ klub: { meno: k.meno, nazov: k.nazov, erb: k.erb, f1: k.f1, f2: k.f2, stadion: STADION[(k.stadion || 1) - 1].kap, fans: k.fans, hraci: hraci(k.meno).map(h => ({ id: h.id, meno: h.meno, post: h.post, vek: h.vek, ovr: ovr(h), cena: cena(h), goly: h.goly, zran: h.zran, ...Object.fromEntries(ATTR.map(a => [a, A(h, a)])) })) } });
  }
  if (path === '/mz/zapas') {
    const z = rows('SELECT * FROM mz_zapas WHERE id=?', Number(body.id))[0];
    if (!z) return err('Zápas sa nenašiel.', 404);
    const a = tim(z.dom), b = tim(z.hos), u = J(z.udalosti, { ev: [] }), lm = z.vyzva ? vyzMin(z.t0) : z.hotovo ? null : liveMin(z.den, z.hod || KOLO_HOD);
    if (!z.vyzva && !z.hotovo && lm == null && !skoncene(z.den, z.hod || KOLO_HOD)) return err('Zápas sa ešte nezačal.');
    if (lm != null) { u.ev = u.ev.filter(e => e.m <= lm); z.gd = u.ev.filter(e => e.t === 'gol' && e.s === 'd').length; z.gh = u.ev.filter(e => e.t === 'gol' && e.s === 'h').length; z.live = lm; u.xg = null; z.pen = null; }
    delete u.zdi; delete u.zhi; delete u.hd; delete u.hh;
    return out({ zapas: { ...z, pen: J(z.pen, null), udalosti: u, dn: a ? a.nazov : z.dom, hn: b ? b.nazov : z.hos, de: a ? a.erb : '', he: b ? b.erb : '', df: a ? [a.f1, a.f2] : null, hf: b ? [b.f1, b.f2] : null, dform: a ? a.form : '4-4-2', hform: b ? b.form : '4-4-2' } });
  }
  if (path === '/mz/vyzva' && t) {
    const b = tim(String(body.super || ''));
    if (!b || b.meno === meno) return err('Vyber súpera.');
    const dnes = rows('SELECT COUNT(*) AS n FROM mz_zapas WHERE vyzva=1 AND dom=? AND den=?', meno, now.den)[0].n;
    if (dnes >= VYZVY_DEN) return err(`Dnes si už odohral ${VYZVY_DEN} priateľské zápasy.`);
    const r = simuluj(tim(meno), b, false);
    sql("INSERT INTO mz_zapas (sez, kolo, dom, hos, gd, gh, udalosti, den, vyzva, t0, typ) VALUES (0, 0, ?, ?, ?, ?, ?, ?, 1, ?, 'vyzva')", meno, b.meno, r.gA, r.gB, JSON.stringify({ ev: r.ev, xg: r.xg, zd: r.zd, zh: r.zh }), now.den, Date.now());
    return out({ vyzva: rows('SELECT id FROM mz_zapas WHERE vyzva=1 AND dom=? ORDER BY id DESC LIMIT 1', meno)[0].id });
  }

  // ===== stav pre obrazovku =====
  const T = tim(meno);
  const timy = rows('SELECT meno, nazov, erb, f1, f2 FROM mz_tim ORDER BY nazov');
  const nm = m => (timy.find(x => x.meno === m) || {}).nazov || m;
  let sez = null;
  if (s && !s.rozpis) { const nd = timy.length > DIV_LIMIT ? Math.ceil(timy.length / 2) : timy.length, k = Math.max(1, nd + (nd % 2) - 1); sez = { id: s.id, start: s.start, pripravuje: true, n: 2 * k, dni: Math.max(LIGA_DNI, 2 * k), dveLigy: timy.length > DIV_LIMIT }; }
  else if (s) {
    const vsetky = rows('SELECT id, kolo, typ, div, dom, hos, gd, gh, den, hod, hotovo, udalosti, vyzva, t0, pen FROM mz_zapas WHERE sez=? AND vyzva=0 ORDER BY den DESC, hod DESC, id', s.id).map(zivo);
    const liga = vsetky.filter(z => z.typ === 'liga'), roz = JSON.parse(s.rozpis), D = J(s.divizie, [JSON.parse(s.timy)]);
    const mojaDiv = Math.max(1, D.findIndex(d => d.includes(meno)) + 1);
    const dalsie = s.odohrane < s.n ? { kolo: s.odohrane + 1, den: denKola(s, s.odohrane + 1), zapasy: roz[s.odohrane] } : null;
    const pg = J(s.pohar, null), sup = J(s.super, null);
    sez = {
      id: s.id, start: s.start, n: s.n, odohrane: s.odohrane, majster: s.majster, archiv: J(s.archiv, null), dveLigy: D.length > 1, mojaDiv, ucastnik: D.some(d => d.includes(meno)),
      tabulky: D.map((_, i) => tabulka(s, i + 1)), posledne: liga.filter(z => z.kolo === s.odohrane), mojeZapasy: liga.filter(z => z.dom === meno || z.hos === meno), dalsie, koniec: denKola(s, s.n), pohar_max: POHAR_MAX,
      pohar: pg ? { K: pg.K, vitaz: pg.vitaz, timy: pg.timy || null, kola: pg.kola.map((k, i) => ({ den: k.den, pary: k.pary, zapasy: vsetky.filter(z => z.typ === 'pohar' && z.kolo === i + 1) })) } : null,
      super: sup ? { ...sup, zapas: vsetky.find(z => z.typ === 'super') || null } : null,
      strelci: rows('SELECT meno, tim, goly, zapasy FROM mz_stat WHERE sez=? AND goly>0 ORDER BY goly DESC, zapasy LIMIT 10', s.id),
      ziveTeraz: vsetky.filter(z => z.live != null),
    };
  }
  const historia = rows('SELECT id, archiv FROM mz_sez WHERE archiv IS NOT NULL ORDER BY id DESC LIMIT 10').map(x => { const a = J(x.archiv, {}); return { id: x.id, majster: nm(a.majster), majster2: a.majster2 ? nm(a.majster2) : null, pohar: a.pohar ? nm(a.pohar) : null, strelec: a.strelec ? { ...a.strelec, tim: nm(a.strelec.tim) } : null, postup: (a.postup || []).map(nm), zostup: (a.zostup || []).map(nm) }; });
  const zz = rows("SELECT dom, hos, gd, gh, den, sez FROM mz_zapas WHERE vyzva=0 AND hotovo=1 AND gd IS NOT NULL ORDER BY den, id");
  const vyhra = zz.slice().sort((a, b) => Math.abs(b.gd - b.gh) - Math.abs(a.gd - a.gh))[0], gol = zz.slice().sort((a, b) => (b.gd + b.gh) - (a.gd + a.gh))[0];
  const seria = {}; let best = null;
  for (const z of zz) for (const [m, g, gi] of [[z.dom, z.gd, z.gh], [z.hos, z.gh, z.gd]]) { seria[m] = g > gi ? (seria[m] || 0) + 1 : 0; if (!best || seria[m] > best.n) best = { tim: nm(m), n: seria[m] }; }
  const rekordy = { vyhra: vyhra ? { txt: `${nm(vyhra.dom)} ${vyhra.gd}:${vyhra.gh} ${nm(vyhra.hos)}`, sez: vyhra.sez } : null, goly: gol ? { txt: `${nm(gol.dom)} ${gol.gd}:${gol.gh} ${nm(gol.hos)}`, n: gol.gd + gol.gh } : null, seria: best && best.n ? best : null,
    strelciVsetkych: rows('SELECT meno, tim, SUM(goly) AS goly, SUM(zapasy) AS zapasy FROM mz_stat GROUP BY hid ORDER BY goly DESC LIMIT 10').map(x => ({ ...x, tim: nm(x.tim) })) };
  const H = T ? hraci(meno) : [];
  return out({
    meno, kolo_hod: KOLO_HOD, pohar_hod: POHAR_HOD, liga_start: LIGA_START, live_min: LIVE_MIN, timy, sez, historia, rekordy,
    tim: T ? {
      ...T, taktika: Object.assign({ presing: 'stredny', styl: 'kombinacia', pasca: false }, J(T.taktika, {})), striedania: J(T.striedania, []),
      zostava: zostava(T).hraci.map(x => ({ id: x.h.id, p: x.p })),
      hraci: H.map(h => ({ ...h, ...Object.fromEntries(ATTR.map(a => [a, A(h, a)])), ovr: ovr(h), cena: cena(h), plat: plat(h), tb: Object.fromEntries(ATTR.map(a => [a, tbCena(A(h, a))])) })),
      platy: H.reduce((a, h) => a + plat(h), 0), stadionKap: STADION[(T.stadion || 1) - 1].kap, stadionDalsi: STADION[T.stadion || 1] || null,
      vyzvy: rows('SELECT id, dom, hos, gd, gh, t0, udalosti, vyzva, hotovo, den, hod FROM mz_zapas WHERE vyzva=1 AND (dom=? OR hos=?) ORDER BY id DESC LIMIT 5', meno, meno).map(zivo),
      ponukyPrijate: rows("SELECT p.id, p.cena, p.kupec, h.meno AS hrac, h.id AS hid FROM mz_ponuka p JOIN mz_hrac h ON h.id=p.hid WHERE p.predajca=? AND p.stav='caka' ORDER BY p.t DESC", meno).map(p => ({ ...p, kupecN: nm(p.kupec) })),
      ponukyMoje: rows("SELECT p.id, p.cena, p.predajca, p.stav, h.meno AS hrac FROM mz_ponuka p LEFT JOIN mz_hrac h ON h.id=p.hid WHERE p.kupec=? ORDER BY p.t DESC LIMIT 8", meno).map(p => ({ ...p, predajcaN: nm(p.predajca) })),
      log: rows('SELECT t, txt FROM mz_log WHERE tim=? ORDER BY id DESC LIMIT 15', meno),
    } : null,
    trh: T ? trh() : [],
    pravidla: { TB_TRENING, TB_KOLO, MAX_KADER, MIN_KADER, VYZVY_DEN, formacie: Object.keys(FORM), stadion: STADION, DIV_LIMIT, POSTUP },
  });
}
const normMn = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
