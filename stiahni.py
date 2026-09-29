"""Stiahne tabuľky, zápasy a štatistiky zo Sportnetu do data/ligy.json.
Spúšťa ho GitHub Actions. Ak niektorá liga zlyhá, ostanú jej posledné uložené údaje."""
import datetime, json, pathlib, re
import requests
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = pathlib.Path.cwd()  # GitHub Actions spúšťa skript z koreňa repozitára
OUT = ROOT / 'data' / 'ligy.json'
US = 'TJ Klas Beša'
BYE = 'Nez. družstvo'
TEAM_URL = 'https://sportnet.sme.sk/futbalnet/k/tj-klas-besa/tim/dospeli-m-a/'

S = requests.Session()
S.headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 14) TJKlasBesa/1.0'


RAW = {}


def get(url):
    r = S.get(url, timeout=30)
    r.raise_for_status()
    RAW[url] = r.text
    return BeautifulSoup(r.text, 'html.parser')


def clean(el):
    return re.sub(r'\s+', ' ', el.get_text()).strip() if el is not None else ''


def slug_of(href):
    m = re.search(r'/futbalnet/k/([^/]+)', href or '')
    return m.group(1) if m else ''


def expand_row(tr):
    out = []
    for c in tr.find_all(['td', 'th'], recursive=False):
        try:
            n = max(1, int(c.get('colspan') or 1))
        except ValueError:
            n = 1
        out.append(c)
        out.extend([None] * (n - 1))
    return out


def header_map(tb):
    hr = next((tr for tr in tb.find_all('tr') if tr.find('th')), None)
    if not hr:
        return None
    labels = [clean(c).lower() for c in expand_row(hr)]

    def find(rx):
        return next((i for i, l in enumerate(labels) if re.fullmatch(rx, l)), -1)
    m = {'z': find(r'z|zá?p\.?|zápasy'), 'v': find(r'v|výhry'), 'r': find(r'r|remízy'),
         'p': find(r'p|prehry'), 'g': find(r'skóre|g|góly|s'), 'b': find(r'b|body|bd\.?')}
    return m if m['b'] >= 0 else None


def parse_table(soup):
    best = []
    for tb in soup.find_all('table'):
        rows, hm = [], header_map(tb)
        for tr in tb.find_all('tr'):
            a = tr.find('a', href=re.compile(r'/futbalnet/k/'))
            if not a:
                continue
            txt = [clean(c) for c in expand_row(tr)]
            pos = next((int(t.rstrip('.')) for t in txt if re.fullmatch(r'\d+\.?', t)), len(rows) + 1)
            r = {'pos': pos, 'name': clean(a), 'slug': slug_of(a.get('href')), 'g': '',
                 'z': None, 'v': None, 'r': None, 'p': None, 'b': None}

            def num(i):
                return int(txt[i]) if 0 <= i < len(txt) and re.fullmatch(r'-?\d+', txt[i]) else None
            if hm:
                for k in 'zvrpb':
                    r[k] = num(hm[k])
                if 0 <= hm['g'] < len(txt):
                    r['g'] = txt[hm['g']].replace(' ', '')
            if r['b'] is None:
                # bez hlavičky: body sú prvé číslo hneď za skóre, pred skóre sú Z (V R P)
                cells = tr.find_all(['td', 'th'], recursive=False)
                ai = next((i for i, c in enumerate(cells) if a in c.descendants), -1)
                after = [clean(c) for c in cells[ai + 1:]]
                gi = next((i for i, t in enumerate(after) if re.fullmatch(r'\d+\s*:\s*\d+', t)), -1)
                if gi < 0:
                    continue
                r['g'] = after[gi].replace(' ', '')
                before = [int(t) for t in after[:gi] if re.fullmatch(r'\d+', t)]
                aft = next((t for t in after[gi + 1:] if re.fullmatch(r'-?\d+', t)), None)
                if aft is None or not before:
                    continue
                r['b'], r['z'] = int(aft), before[0]
                if len(before) >= 4:
                    r['v'], r['r'], r['p'] = before[1], before[2], before[3]
            if r['b'] is None or r['z'] is None:
                continue
            rows.append(r)
        if len(rows) >= 5 and len(rows) > len(best):
            best = rows
    return best


def season_year():
    d = datetime.date.today()
    return d.year if d.month >= 7 else d.year - 1


def parse_anchor(a, mid, names, rnd):
    # medzera medzi prvkami, inak sa skóre 2 a 0 zlepí do "20"
    text = re.sub(r'\s+', ' ', a.get_text(' ')).strip()
    lst = names or [i.get('alt', '').strip() for i in a.find_all('img') if i.get('alt')]
    lst = list(dict.fromkeys(lst + [BYE]))
    found = sorted([(text.find(n), n) for n in lst if text.find(n) >= 0])
    if len(found) < 2:
        return None
    home, away = found[0][1], found[1][1]
    after = text[text.rfind(away) + len(away):]
    sm = re.match(r'\s*(\d{1,2})\s*(?::|\s)\s*(\d{1,2})(?![\d:.])', after)
    dm = re.search(r'(\d{1,2})\.(\d{1,2})\.?\s*(\d{1,2}):(\d{2})', text)
    date = time = None
    if dm:
        mo, sy = int(dm.group(2)), season_year()
        y = sy if mo >= 7 else sy + 1
        date = f'{y}-{mo:02d}-{int(dm.group(1)):02d}'
        time = f'{int(dm.group(3)):02d}:{dm.group(4)}'
    return {'id': mid, 'round': rnd, 'home': home, 'away': away,
            'hs': int(sm.group(1)) if sm else None, 'as': int(sm.group(2)) if sm else None,
            'date': date, 'time': time}


def in_match_link(node):
    return any(isinstance(p, Tag) and p.name == 'a' and '/zapas/' in (p.get('href') or '') for p in node.parents)


def parse_matches(soup, names):
    out, rnd = [], None
    for n in list((soup.body or soup).descendants):
        if isinstance(n, Tag):
            if n.name == 'a':
                m = re.search(r'/zapas/([a-f0-9]+)', n.get('href') or '', re.I)
                if m:
                    x = parse_anchor(n, m.group(1), names, rnd)
                    if x:
                        out.append(x)
        elif isinstance(n, NavigableString):
            k = re.search(r'(\d{1,2})\.\s*kolo\b', n.strip(), re.I)
            if k and not in_match_link(n):
                rnd = int(k.group(1))
    return out


def parse_stats(soup):
    out = []
    for tb in soup.find_all('table'):
        if len(out) >= 4:
            break
        trs = tb.find_all('tr')
        head = [clean(t) for t in trs[0].find_all('th')] if trs else []
        rows = [[clean(td) for td in tr.find_all('td')] for tr in trs]
        rows = [r for r in rows if len(r) > 1 and any(r)]
        if len(rows) < 2:
            continue
        h = tb.find_previous(['h1', 'h2', 'h3', 'h4'])
        out.append({'title': clean(h) or 'Štatistika', 'head': head, 'rows': rows[:15]})
    return out


def scrape(lg, prev):
    B = lg['url']
    src = {'tabulky': B + 'tabulky/', 'prehlad': B, 'vysledky': B + 'vysledky/',
           'program': B + 'program/', 'statistiky': B + 'statistiky/'}
    if lg.get('home'):
        src['tim_vysledky'] = TEAM_URL + 'vysledky/'
        src['tim_program'] = TEAM_URL + 'program/'
    docs = {}
    for k, u in src.items():
        try:
            docs[k] = get(u)
        except Exception as e:
            print(f'  {k}: CHYBA {e}')
    teams = parse_table(docs['tabulky']) if 'tabulky' in docs else []
    if not teams and 'prehlad' in docs:
        teams = parse_table(docs['prehlad'])
    names = [t['name'] for t in teams]
    if lg.get('home') and US not in names:
        names.append(US)
    ms = {}
    for k in ('prehlad', 'vysledky', 'program', 'tim_vysledky', 'tim_program'):
        if k not in docs:
            continue
        for m in parse_matches(docs[k], names):
            o = ms.get(m['id'])
            if not o:
                ms[m['id']] = m
            else:
                if o['hs'] is None and m['hs'] is not None:
                    o['hs'], o['as'] = m['hs'], m['as']
                if o['round'] is None:
                    o['round'] = m['round']
    stats = parse_stats(docs['statistiky']) if 'statistiky' in docs else []
    us = next((t for t in teams if t['name'] == US), None)
    print(f"  tímov {len(teams)}, zápasov {len(ms)}, štatistík {len(stats)}" + (f", Beša {us['pos']}. miesto {us['b']} b" if us else ''))
    ok = bool(teams or ms)
    return {'id': lg['id'], 'name': lg['name'], 'home': bool(lg.get('home')),
            'at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds') if ok else prev.get('at'),
            'teams': teams or prev.get('teams', []),
            'matches': list(ms.values()) or prev.get('matches', []),
            'stats': stats or prev.get('stats', [])}


def debug_dump(home_league):
    """Dočasne: uloží surové stránky do data/debug, aby sa dal doladiť detail zápasu, rozhodcovia a live."""
    d = ROOT / 'data' / 'debug'
    d.mkdir(parents=True, exist_ok=True)
    B = home_league['url']
    pages = {'liga_prehlad': B, 'liga_vysledky': B + 'vysledky/', 'liga_tabulky': B + 'tabulky/',
             'tim_vysledky': TEAM_URL + 'vysledky/', 'tim_program': TEAM_URL + 'program/'}
    info = []
    for k, u in pages.items():
        html = RAW.get(u)
        if html is None:
            try:
                html = S.get(u, timeout=30).text
            except Exception as e:
                info.append(f'{k}: CHYBA {e}')
                continue
        (d / f'{k}.html').write_text(html, encoding='utf-8')
    try:
        for name, key in (('zapas_odohrany', 'vysledky/'), ('zapas_buduci', 'program/')):
            soup = BeautifulSoup(RAW.get(TEAM_URL + key, ''), 'html.parser')
            link = soup.find('a', href=re.compile(r'/zapas/'))
            if link:
                u = requests.compat.urljoin('https://sportnet.sme.sk/', link['href'])
                (d / f'{name}.html').write_text(S.get(u, timeout=30).text, encoding='utf-8')
                info.append(f'{name}: {u}')
    except Exception as e:
        info.append(f'detail: CHYBA {e}')
    urls = set()
    for html in RAW.values():
        urls.update(re.findall(r'https://[a-z0-9.-]*sportnet\.online/[^"\'\s<>\\]*', html))
    for u in sorted(u for u in urls if not re.search(r'\.(png|jpe?g|svg|webp|gif|css|js)(\?|$)|/logo', u))[:15]:
        try:
            r = S.get(u, timeout=20, headers={'Origin': 'https://luboliak.github.io'})
            info.append(f'API {r.status_code} CORS={r.headers.get("Access-Control-Allow-Origin")} {u}')
        except Exception as e:
            info.append(f'API CHYBA {e} {u}')
    (d / 'info.txt').write_text('\n'.join(info), encoding='utf-8')


def main():
    leagues = json.loads((ROOT / 'ligy.json').read_text(encoding='utf-8'))
    old = {}
    if OUT.exists():
        try:
            old = {l['id']: l for l in json.loads(OUT.read_text(encoding='utf-8')).get('ligy', [])}
        except Exception:
            pass
    res = []
    for lg in leagues:
        print(lg['name'])
        try:
            res.append(scrape(lg, old.get(lg['id'], {})))
        except Exception as e:
            print(f'  CHYBA {e}')
            if lg['id'] in old:
                res.append(old[lg['id']])
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({'ligy': res}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    home = next((l for l in leagues if l.get('home')), None)
    if home:
        try:
            debug_dump(home)
        except Exception as e:
            print('debug:', e)


if __name__ == '__main__':
    main()
