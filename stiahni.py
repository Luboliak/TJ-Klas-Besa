"""Stiahne tabuľky, zápasy a štatistiky zo Sportnetu do data/ligy.json.
Spúšťa ho GitHub Actions. Ak niektorá liga zlyhá, ostanú jej posledné uložené údaje."""
import datetime, json, pathlib, re, shutil
from concurrent.futures import ThreadPoolExecutor
import requests
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = pathlib.Path.cwd()  # GitHub Actions spúšťa skript z koreňa repozitára
OUT = ROOT / 'data' / 'ligy.json'
US = 'TJ Klas Beša'
BYE = 'Nez. družstvo'
TEAM_URL = 'https://sportnet.sme.sk/futbalnet/k/tj-klas-besa/tim/dospeli-m-a/'

S = requests.Session()
S.headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 14) TJKlasBesa/1.0'


UA = {'User-Agent': S.headers['User-Agent']}
FULL_EVERY = datetime.timedelta(hours=6)   # celý rozpis cez stránky tímov stačí raz za 6 hodín


def get(url):
    r = requests.get(url, timeout=30, headers=UA)
    r.raise_for_status()
    return BeautifulSoup(r.text, 'html.parser')


def get_many(urls):
    def one(u):
        try:
            return u, get(u)
        except Exception as e:
            print(f'  {u}: CHYBA {e}')
            return u, None
    with ThreadPoolExecutor(6) as ex:
        return dict(ex.map(one, urls))


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
            r = {'pos': pos, 'name': clean(a), 'slug': slug_of(a.get('href')), 'href': a.get('href'), 'g': '',
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
            'date': date, 'time': time, 'url': requests.compat.urljoin('https://sportnet.sme.sk/', a.get('href'))}


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


def merge(ms, m):
    o = ms.get(m['id'])
    if not o:
        ms[m['id']] = m
        return
    for k in ('round', 'date', 'time', 'url', 'home', 'away'):
        if m.get(k) is not None:
            o[k] = m[k]
    if m.get('hs') is not None:
        o['hs'], o['as'] = m['hs'], m['as']


def scrape(lg, prev):
    B = lg['url']
    src = {'tabulky': B + 'tabulky/', 'prehlad': B, 'vysledky': B + 'vysledky/',
           'program': B + 'program/', 'statistiky': B + 'statistiky/'}
    got = get_many(src.values())
    docs = {k: got[u] for k, u in src.items() if got.get(u) is not None}
    teams = parse_table(docs['tabulky']) if 'tabulky' in docs else []
    if not teams and 'prehlad' in docs:
        teams = parse_table(docs['prehlad'])
    names = [t['name'] for t in teams] or [t['name'] for t in prev.get('teams', [])]
    if lg.get('home') and US not in names:
        names.append(US)
    ms = {}
    for m in prev.get('matches', []):
        ms[m['id']] = dict(m)
    for k in ('prehlad', 'vysledky', 'program'):
        if k in docs:
            for m in parse_matches(docs[k], names):
                merge(ms, m)
    # celý rozpis: stránky výsledkov a programu každého tímu (Sportnet inak ukazuje len posledné kolá)
    full_at = prev.get('full_at')
    now = datetime.datetime.now(datetime.timezone.utc)
    if not full_at or now - datetime.datetime.fromisoformat(full_at) > FULL_EVERY:
        hrefs = {t['href'] for t in (teams or prev.get('teams', [])) if t.get('href')}
        if lg.get('home'):
            hrefs.add(TEAM_URL.replace('https://sportnet.sme.sk', ''))
        urls = []
        for h in hrefs:
            base = requests.compat.urljoin('https://sportnet.sme.sk/', h)
            urls += [base + 'vysledky/', base + 'program/']
        pages = get_many(urls)
        for soup in pages.values():
            if soup is not None:
                for m in parse_matches(soup, names):
                    merge(ms, m)
        if pages and sum(v is not None for v in pages.values()) >= len(pages) * 0.8:
            full_at = now.isoformat(timespec='seconds')
        print(f'  celý rozpis: {len(pages)} stránok tímov')
    stats = parse_stats(docs['statistiky']) if 'statistiky' in docs else []
    us = next((t for t in teams if t['name'] == US), None)
    print(f"  tímov {len(teams)}, zápasov {len(ms)}, štatistík {len(stats)}" + (f", Beša {us['pos']}. miesto {us['b']} b" if us else ''))
    ok = bool(teams or ms)
    return {'id': lg['id'], 'name': lg['name'], 'home': bool(lg.get('home')), 'url': B,
            'at': now.isoformat(timespec='seconds') if ok else prev.get('at'), 'full_at': full_at,
            'teams': teams or prev.get('teams', []),
            'matches': list(ms.values()),
            'stats': stats or prev.get('stats', [])}


def rsc_text(html):
    """Next.js vkladá dáta stránky ako reťazce v self.__next_f.push([1,"..."])."""
    out = []
    for p in re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', html):
        try:
            out.append(json.loads('"' + p + '"'))
        except ValueError:
            pass
    return ''.join(out)


def compact_match(m):
    teams = m.get('teams') or []
    side = {t.get('_id'): ('home' if (t.get('additionalProperties') or {}).get('homeaway') == 'home' else 'away') for t in teams}
    names = {side[t.get('_id')]: t.get('name') for t in teams}
    ev = []
    for e in (m.get('protocol') or {}).get('events') or []:
        ev.append({'t': e.get('eventType'), 'k': e.get('type'), 'ph': e.get('phase'),
                   'min': (e.get('eventTime') or '').split(':')[0], 'side': side.get(e.get('team')),
                   'p': (e.get('player') or {}).get('name'), 'r': (e.get('replacement') or {}).get('name')})
    lineups = {}
    for n in m.get('nominations') or []:
        sd = side.get(n.get('teamId'))
        if not sd:
            continue
        pl = []
        for a in n.get('athletes') or []:
            ad = a.get('additionalData') or {}
            pl.append({'nr': ad.get('nr'), 'name': (a.get('sportnetUser') or {}).get('name'),
                       'sub': bool(ad.get('substitute')), 'c': bool(ad.get('captain')), 'gk': ad.get('position') == 'goalkeeper'})
        crew = [{'pos': c.get('position'), 'name': (c.get('sportnetUser') or {}).get('name')} for c in n.get('crew') or []]
        lineups[sd] = {'players': pl, 'crew': crew}
    return {'id': m.get('_id'), 'status': m.get('__issfMatchStatus'), 'closed': bool(m.get('closed')),
            'start': m.get('startDate'), 'round': (m.get('round') or {}).get('name'),
            'comp': (m.get('competition') or {}).get('name'), 'ground': (m.get('sportGround') or {}).get('name'),
            'home': names.get('home'), 'away': names.get('away'), 'score': m.get('score'),
            'phases': m.get('scoreByPhases'), 'timer': m.get('timer'),
            'refs': [{'role': (x.get('type') or {}).get('label'), 'name': (x.get('user') or {}).get('name')} for x in m.get('managers') or []],
            'events': ev, 'lineups': lineups,
            'at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}


def match_detail(url):
    t = rsc_text(requests.get(url, timeout=30, headers=UA).text)
    i = t.find('"match":{"_id"')
    if i < 0:
        return None
    return compact_match(json.JSONDecoder().raw_decode(t, i + 8)[0])


def update_details(res):
    """Detaily zápasov (strelci, karty, zostavy, rozhodcovia, live) okolo dneška a všetky zápasy Beše.
    Uzavreté zápasy sa už nesťahujú. Zápasy do 3 dní dopredu pri každom behu, ostatné raz za 6 hodín."""
    d = ROOT / 'data' / 'zapasy'
    d.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today()
    now = datetime.datetime.now(datetime.timezone.utc)
    lo, hi = (today - datetime.timedelta(days=8)).isoformat(), (today + datetime.timedelta(days=10)).isoformat()
    soon = (today + datetime.timedelta(days=3)).isoformat()
    olds, todo = {}, []
    for lg in res:
        for m in lg.get('matches', []):
            ours = US in (m.get('home'), m.get('away'))
            near = m.get('date') and lo <= m['date'] <= hi
            if not m.get('url') or not (near or ours) or BYE in (m.get('home'), m.get('away')):
                continue
            f = d / f"{m['id']}.json"
            old = None
            if f.exists():
                try:
                    old = json.loads(f.read_text(encoding='utf-8'))
                except ValueError:
                    pass
            olds[m['id']] = old
            if old and old.get('closed'):
                continue
            fresh = old and old.get('at') and now - datetime.datetime.fromisoformat(old['at']) < FULL_EVERY
            if not old or (m.get('date') and m['date'] <= soon) or not fresh:
                todo.append(m)

    def one(m):
        try:
            return m['id'], match_detail(m['url'])
        except Exception as e:
            print(f"  detail {m['id']}: CHYBA {e}")
            return m['id'], None
    with ThreadPoolExecutor(6) as ex:
        for mid, det in ex.map(one, todo):
            if det:
                (d / f'{mid}.json').write_text(json.dumps(det, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
                olds[mid] = det
    for lg in res:
        for m in lg.get('matches', []):
            old = olds.get(m['id'])
            if not old:
                continue
            ref = next((r['name'] for r in old.get('refs', []) if r.get('role') == 'Rozhodca'), None)
            if ref:
                m['ref'] = ref
            if old.get('closed') and old.get('score'):
                m['hs'], m['as'] = old['score'][0], old['score'][1]
            m['det'] = True
    print(f'Detaily zápasov: stiahnutých {len(todo)}')


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
    shutil.rmtree(ROOT / 'data' / 'debug', ignore_errors=True)  # ukážkové stránky už netreba
    try:
        update_details(res)
    except Exception as e:
        print('Detaily zápasov: CHYBA', e)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({'ligy': res}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


if __name__ == '__main__':
    main()
