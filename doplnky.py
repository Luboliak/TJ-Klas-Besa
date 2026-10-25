"""Doplnky k appke TJ Klas Beša. Spúšťa sa v GitHub Actions po stiahni.py.

- data/klub.json      štatistiky hráčov Beše zo zápisov o stretnutí
- data/foto.json      galéria z priečinka foto/ (náhľady sa vyrobia samy)
- data/kalendar.ics   zápasy Beše a tréningy do kalendára v telefóne
- upozornenia cez ntfy: góly a výsledky Beše, deň zápasu, zmeny tréningov, nové aktuality
"""
import datetime, hashlib, io, json, os, pathlib, re
from zoneinfo import ZoneInfo

import requests

ROOT = pathlib.Path.cwd()
DATA = ROOT / 'data'
US = 'TJ Klas Beša'
BYE = 'Nez. družstvo'
TZ = ZoneInfo('Europe/Bratislava')
NOW = datetime.datetime.now(TZ)
TODAY = NOW.date()


def jload(p, default):
    try:
        return json.loads(pathlib.Path(p).read_text(encoding='utf-8'))
    except Exception:
        return default


def jsave(p, obj):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def read(p):
    try:
        return (ROOT / p).read_text(encoding='utf-8').replace('\r', '')
    except FileNotFoundError:
        return ''


def site_url():
    repo = os.environ.get('GITHUB_REPOSITORY', 'Luboliak/TJ-Klas-Besa')
    owner, name = repo.split('/')
    return f'https://{owner.lower()}.github.io/{name}/'


def setting(name):
    m = re.search(rf"{name}\s*=\s*['\"]([^'\"]*)['\"]", read('nastavenie.js'))
    return m.group(1).strip() if m else ''


def pdate(s):
    s = (s or '').strip()
    m = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', s)
    if m:
        return datetime.date(int(m[1]), int(m[2]), int(m[3]))
    m = re.match(r'(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})?', s)
    if m:
        try:
            return datetime.date(int(m[3] or TODAY.year), int(m[2]), int(m[1]))
        except ValueError:
            return None
    return None


DNI = ['po', 'ut', 'st', 'št', 'pi', 'so', 'ne']


def dlabel(d):
    return f'{DNI[d.weekday()]} {d.day}.{d.month}.'


# ---------------------------------------------------------------- zápasy Beše

def our_matches():
    ligy = jload(DATA / 'ligy.json', {}).get('ligy', [])
    home = next((l for l in ligy if l.get('home')), None)
    if not home:
        return []
    out = []
    for m in home.get('matches', []):
        if US not in (m.get('home'), m.get('away')) or BYE in (m.get('home'), m.get('away')):
            continue
        det = jload(DATA / 'zapasy' / f"{m['id']}.json", None)
        out.append((m, det))
    out.sort(key=lambda x: (x[0].get('date') or '', x[0].get('time') or ''))
    return out


def goal_for(e, our_side):
    """Komu sa gól počíta. Vlastný gól (k=dropped) je zapísaný pri tíme hráča, ale počíta sa súperovi."""
    own = e.get('k') == 'dropped'
    return (e.get('side') != our_side) if own else (e.get('side') == our_side)


# ---------------------------------------------------------------- štatistiky

def stats():
    players = {}
    played = 0
    for m, det in our_matches():
        if not det or not det.get('closed') or not det.get('lineups'):
            continue
        side = 'home' if det.get('home') == US else 'away'
        lu = det['lineups'].get(side)
        if not lu:
            continue
        played += 1
        sc = det.get('score') or [0, 0]
        my, th = (sc[0], sc[1]) if side == 'home' else (sc[1], sc[0])
        res = 'V' if my > th else 'P' if my < th else 'R'
        opp = det.get('away') if side == 'home' else det.get('home')
        ev = [e for e in det.get('events', []) if e.get('side') == side]

        def minute(e):
            try:
                return int(e.get('min') or 0)
            except ValueError:
                return 0
        info = {}
        for p in lu.get('players', []):
            info[p['name']] = {'start': not p.get('sub'), 'nr': p.get('nr'), 'gk': p.get('gk'), 'c': p.get('c'),
                               'in': 0 if not p.get('sub') else None, 'out': None, 'g': 0, 'pk': 0, 'vg': 0, 'zk': 0, 'ck': 0}
        for e in ev:
            t, p, r = e.get('t'), e.get('p'), e.get('r')
            if t == 'substitution':
                if p in info and info[p]['out'] is None:
                    info[p]['out'] = minute(e)
                if r in info:
                    info[r]['in'] = minute(e)
            elif t == 'goal' and p in info:
                if e.get('k') == 'dropped':
                    info[p]['vg'] += 1
                else:
                    info[p]['g'] += 1
                    if e.get('k') == 'goal_penalty':
                        info[p]['pk'] += 1
            elif t == 'yellow_card' and p in info:
                info[p]['zk'] += 1
            elif t in ('red_card', 'second_yellow_card') and p in info:
                info[p]['ck'] += 1
                if info[p]['out'] is None:
                    info[p]['out'] = minute(e)
        for name, x in info.items():
            if x['in'] is None:
                continue  # náhradník, ktorý nenastúpil
            mins = max(0, min(90, x['out'] if x['out'] is not None else 90) - x['in'])
            pl = players.setdefault(name, {'name': name, 'nr': {}, 'z': 0, 'zs': 0, 'min': 0, 'g': 0, 'pk': 0, 'vg': 0,
                                           'zk': 0, 'ck': 0, 'gk': 0, 'c': 0, 'matches': []})
            if x['nr'] is not None:
                pl['nr'][str(x['nr'])] = pl['nr'].get(str(x['nr']), 0) + 1
            pl['z'] += 1
            pl['zs'] += 1 if x['start'] else 0
            pl['gk'] += 1 if x['gk'] else 0
            pl['c'] += 1 if x['c'] else 0
            pl['min'] += mins
            for k in ('g', 'pk', 'vg', 'zk', 'ck'):
                pl[k] += x[k]
            pl['matches'].append({'id': m['id'], 'date': m.get('date'), 'round': m.get('round'), 'opp': opp,
                                  'home': side == 'home', 'score': f'{my}:{th}', 'res': res, 'start': x['start'],
                                  'min': mins, 'g': x['g'], 'zk': x['zk'], 'ck': x['ck']})
    out = []
    for pl in players.values():
        pl['nr'] = int(max(pl['nr'], key=pl['nr'].get)) if pl['nr'] else None
        pl['gk'] = pl['gk'] * 2 >= pl['z']
        pl['matches'].sort(key=lambda x: x['date'] or '', reverse=True)
        out.append(pl)
    out.sort(key=lambda p: (-p['g'], -p['z'], p['name']))
    jsave(DATA / 'klub.json', {'at': NOW.isoformat(timespec='seconds'), 'zapasy': played, 'hraci': out})
    print(f'Štatistiky: {played} zápasov, {len(out)} hráčov')


# ---------------------------------------------------------------- galéria

IMG = ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif')


def gallery():
    src = ROOT / 'foto'
    dst = DATA / 'foto'
    files = sorted(p for p in src.rglob('*') if p.is_file() and p.suffix.lower() in IMG) if src.exists() else []
    if not files:
        jsave(DATA / 'foto.json', {'albums': []})
        return
    from PIL import Image, ImageOps
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except Exception:
        pass
    dst.mkdir(parents=True, exist_ok=True)
    albums, keep = {}, set()
    for f in files:
        rel = f.relative_to(src)
        album = rel.parts[0] if len(rel.parts) > 1 else 'Fotky'
        h = hashlib.sha1(f.read_bytes()).hexdigest()[:16]
        n, v = dst / f'{h}-n.jpg', dst / f'{h}-v.jpg'
        keep.update({n.name, v.name})
        if not (n.exists() and v.exists()):
            try:
                im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
                for path, size, q in ((v, 1600, 82), (n, 480, 75)):
                    c = im.copy()
                    c.thumbnail((size, size))
                    c.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
            except Exception as e:
                print(f'  foto {rel}: CHYBA {e}')
                continue
        w, hgt = Image.open(n).size
        albums.setdefault(album, []).append({'n': f'data/foto/{n.name}', 'v': f'data/foto/{v.name}',
                                             'o': 'foto/' + '/'.join(rel.parts), 'name': f.stem, 'r': round(w / hgt, 3)})
    for old in dst.iterdir():
        if old.name not in keep:
            old.unlink()
    out = [{'name': a, 'photos': sorted(ph, key=lambda x: x['name'])} for a, ph in albums.items()]
    out.sort(key=lambda a: (a['name'] != 'Fotky', a['name']), reverse=True)
    out.sort(key=lambda a: bool(re.match(r'\d{4}', a['name'])), reverse=True)
    jsave(DATA / 'foto.json', {'albums': out})
    print(f'Galéria: {len(files)} fotiek, {len(out)} albumov')


# ---------------------------------------------------------------- tréningy (rovnaké pravidlá ako v appke)

DEN = {'pondelok': 0, 'utorok': 1, 'streda': 2, 'stvrtok': 3, 'štvrtok': 3, 'piatok': 4, 'sobota': 5, 'nedela': 6, 'nedeľa': 6}


def tren_lines():
    return [l.strip() for l in read('treningy.txt').split('\n') if l.strip() and not l.strip().startswith('#')]


def trainings(frm, to):
    reg, extra, pauses = [], {}, []
    for l in tren_lines():
        m = re.match(r'^pravideln[eé][^:|]*:\s*(.*)$', l, re.I)
        if m:
            p = [x.strip() for x in m[1].split('|')]
            dw = DEN.get((p[0] if p else '').lower())
            if dw is not None:
                reg.append({'dw': dw, 'cas': p[1] if len(p) > 1 else '', 'kde': p[2] if len(p) > 2 else '', 'pozn': p[3] if len(p) > 3 else ''})
            continue
        m = re.match(r'^prest[aá]vka[^:|]*:\s*(.+?)\s*[-–]\s*(.+?)\s*(?:\|\s*(.*))?$', l, re.I)
        if m:
            a, b = pdate(m[1]), pdate(m[2])
            if a and b:
                pauses.append((a, b))
            continue
        p = [x.strip() for x in l.split('|')]
        d = pdate(p[0])
        if not d:
            continue
        if re.match(r'^zru[sš]en', p[1] if len(p) > 1 else '', re.I):
            extra[d] = {'d': d, 'cas': '', 'kde': '', 'pozn': p[2] if len(p) > 2 else '', 'zrus': True}
        else:
            extra[d] = {'d': d, 'cas': p[1] if len(p) > 1 else '', 'kde': p[2] if len(p) > 2 else '', 'pozn': p[3] if len(p) > 3 else ''}
    out = {}
    d = frm
    while d <= to:
        if not any(a <= d <= b for a, b in pauses):
            for r in reg:
                if r['dw'] == d.weekday():
                    out[d] = {'d': d, 'cas': r['cas'], 'kde': r['kde'], 'pozn': r['pozn']}
        d += datetime.timedelta(days=1)
    for d, v in extra.items():
        o = out.get(d)
        out[d] = v if v.get('zrus') or not o else {**o, **{k: x for k, x in v.items() if x}}
    return [out[k] for k in sorted(out)]


# ---------------------------------------------------------------- kalendár

def ics_text(s):
    return (s or '').replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', '\\n')


def ics_dt(d, t):
    hh, mm = (t or '00:00').split(':')[:2] if t and ':' in t else ('00', '00')
    local = datetime.datetime(d.year, d.month, d.day, int(hh), int(mm), tzinfo=TZ)
    return local.astimezone(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')


def calendar():
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    ev = []
    for m, det in our_matches():
        d = pdate(m.get('date'))
        if not d or not m.get('time'):
            continue
        home = m.get('home') == US
        opp = m.get('away') if home else m.get('home')
        start = datetime.datetime.combine(d, datetime.time(*map(int, m['time'].split(':'))), TZ)
        end = start + datetime.timedelta(minutes=110)
        desc = []
        if m.get('hs') is not None:
            desc.append(f"Výsledok: {m['hs']}:{m['as']}")
        if m.get('ref'):
            desc.append(f"Rozhodca: {m['ref']}")
        desc.append(site_url())
        ev.append(['BEGIN:VEVENT', f"UID:zapas-{m['id']}@tjklas-besa", f'DTSTAMP:{stamp}',
                   f"DTSTART:{start.astimezone(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                   f"DTEND:{end.astimezone(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                   f"SUMMARY:{ics_text(('⚽ Beša – ' if home else '⚽ ') + (opp if home else opp + ' – Beša'))}",
                   f"LOCATION:{ics_text((det or {}).get('ground') or ('Futbalové ihrisko Beša' if home else ''))}",
                   f"DESCRIPTION:{ics_text(chr(10).join(desc))}", 'END:VEVENT'])
    for t in trainings(TODAY - datetime.timedelta(days=14), TODAY + datetime.timedelta(days=120)):
        uid = f"trening-{t['d'].isoformat()}@tjklas-besa"
        cm = re.match(r'(\d{1,2})[:.](\d{2})', t.get('cas') or '')
        start = datetime.datetime.combine(t['d'], datetime.time(int(cm[1]), int(cm[2])) if cm else datetime.time(18, 0), TZ)
        end = start + datetime.timedelta(minutes=90)
        lines = ['BEGIN:VEVENT', f'UID:{uid}', f'DTSTAMP:{stamp}',
                 f"DTSTART:{start.astimezone(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                 f"DTEND:{end.astimezone(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"]
        if t.get('zrus'):
            lines += ['STATUS:CANCELLED', f"SUMMARY:{ics_text('Tréning ZRUŠENÝ' + (' – ' + t['pozn'] if t.get('pozn') else ''))}"]
        else:
            lines += [f"SUMMARY:{ics_text('Tréning TJ Klas Beša')}", f"LOCATION:{ics_text(t.get('kde'))}",
                      f"DESCRIPTION:{ics_text(t.get('pozn'))}"]
        ev.append(lines + ['END:VEVENT'])
    out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TJ Klas Besa//appka//SK', 'CALSCALE:GREGORIAN',
           'METHOD:PUBLISH', 'X-WR-CALNAME:TJ Klas Beša', 'X-WR-TIMEZONE:Europe/Bratislava',
           'REFRESH-INTERVAL;VALUE=DURATION:PT3H', 'X-PUBLISHED-TTL:PT3H']
    for e in ev:
        out += e
    out.append('END:VCALENDAR')
    (DATA / 'kalendar.ics').write_text('\r\n'.join(out) + '\r\n', encoding='utf-8')
    print(f'Kalendár: {len(ev)} udalostí')


# ---------------------------------------------------------------- upozornenia (ntfy)

def akt_items():
    items = []
    for b in re.split(r'^\s*---+\s*$', read('aktuality.txt'), flags=re.M):
        lines = [l for l in b.split('\n') if not l.strip().startswith('#')]
        while lines and not lines[0].strip():
            lines.pop(0)
        if not lines:
            continue
        first = lines.pop(0).strip()
        m = re.match(r'^(\d{1,2}\.\s*\d{1,2}\.\s*\d{0,4})\s*[|\-–]\s*(.*)$', first)
        title = m[2] if m else first
        items.append({'key': first, 'title': title, 'text': '\n'.join(lines).strip()})
    return items


def describe_tren_line(l):
    m = re.match(r'^pravideln[eé][^:|]*:\s*(.*)$', l, re.I)
    if m:
        p = [x.strip() for x in m[1].split('|')]
        return 'Pravidelné tréningy: ' + ' '.join(x for x in p[:3] if x), None
    m = re.match(r'^prest[aá]vka[^:|]*:\s*(.+?)\s*[-–]\s*(.+?)\s*(?:\|.*)?$', l, re.I)
    if m:
        a, b = pdate(m[1]), pdate(m[2])
        if a and b:
            return f'Prestávka v tréningoch od {a.day}.{a.month}. do {b.day}.{b.month}.{b.year}', b
        return None, None
    p = [x.strip() for x in l.split('|')]
    d = pdate(p[0])
    if not d:
        return None, None
    if re.match(r'^zru[sš]en', p[1] if len(p) > 1 else '', re.I):
        return f'Tréning {dlabel(d)} je ZRUŠENÝ' + (f' – {p[2]}' if len(p) > 2 and p[2] else ''), d
    parts = [x for x in p[1:4] if x]
    return f'Tréning {dlabel(d)}: ' + ', '.join(parts), d


def notify():
    topic = setting('NTFY_TOPIC')
    state_p = DATA / 'upozornenia.json'
    st = jload(state_p, None)
    first = st is None
    st = st or {'sent': [], 'tren': [], 'akt': []}
    sent = set(st.get('sent', []))
    msgs = []

    def add(key, title, text, tags='soccer', prio=3):
        if key in sent:
            return
        sent.add(key)
        msgs.append({'title': title, 'message': text, 'tags': [tags], 'priority': prio})

    for m, det in our_matches():
        d = pdate(m.get('date'))
        if not d or abs((d - TODAY).days) > 1:
            continue
        home = m.get('home') == US
        opp = m.get('away') if home else m.get('home')
        side = 'home' if home else 'away'
        name = f'Beša – {opp}' if home else f'{opp} – Beša'
        if d == TODAY and NOW.hour >= 8:
            extra = f", rozhodca {m['ref']}" if m.get('ref') else ''
            add(f"den:{m['id']}", 'Dnes hráme', f"{name} o {m.get('time') or '?'}{', ' + det['ground'] if det and det.get('ground') else ''}{extra}", 'calendar')
        if not det:
            continue
        sc = det.get('score') or [0, 0]
        txt_score = f"{name} {sc[0]}:{sc[1]}"
        goals = [e for e in det.get('events', []) if e.get('t') == 'goal']
        if det.get('closed'):
            for e in goals:
                sent.add(f"gol:{m['id']}:{e.get('min')}:{e.get('p')}:{e.get('side')}")
            my, th = (sc[0], sc[1]) if home else (sc[1], sc[0])
            res = 'Výhra' if my > th else 'Prehra' if my < th else 'Remíza'
            ours = [f"{e.get('p')} {e.get('min')}'" for e in goals if goal_for(e, side) and e.get('k') != 'dropped']
            add(f"koniec:{m['id']}", f'Koniec zápasu: {res}', txt_score + (f"\nGóly Beše: {', '.join(ours)}" if ours else ''), 'checkered_flag', 4)
            continue
        if det.get('timer'):
            add(f"zaciatok:{m['id']}", 'Zápas začal', name, 'stopwatch')
        h = a = 0
        for i, e in enumerate(goals):
            if goal_for(e, 'home'):
                h += 1
            else:
                a += 1
            ours = goal_for(e, side)
            vg = ' (vlastný gól)' if e.get('k') == 'dropped' else ''
            pk = ' (penalta)' if e.get('k') == 'goal_penalty' else ''
            add(f"gol:{m['id']}:{e.get('min')}:{e.get('p')}:{e.get('side')}", 'Gól Beše! ⚽' if ours else 'Gól súpera',
                f"{name} {h}:{a}\n{e.get('min')}' {e.get('p') or ''}{pk}{vg}", 'soccer', 4 if ours else 3)

    lines = tren_lines()
    for l in lines:
        if l in st.get('tren', []):
            continue
        txt, d = describe_tren_line(l)
        if txt and (d is None or d >= TODAY):
            add('tren:' + hashlib.sha1(l.encode()).hexdigest()[:12], 'Zmena tréningov', txt, 'runner', 4)
    st['tren'] = lines

    items = akt_items()
    for it in items:
        if it['key'] in st.get('akt', []):
            continue
        add('akt:' + hashlib.sha1(it['key'].encode()).hexdigest()[:12], it['title'] or 'Aktualita', it['text'][:500] or it['title'], 'loudspeaker', 3)
    st['akt'] = [it['key'] for it in items]

    st['sent'] = sorted(sent)[-2000:]
    jsave(state_p, st)
    if first:
        print('Upozornenia: prvé spustenie, len som si zapamätal stav')
        return
    if not topic:
        print(f'Upozornenia: NTFY_TOPIC nie je nastavený ({len(msgs)} správ neodoslaných)')
        return
    for msg in msgs:
        try:
            r = requests.post('https://ntfy.sh/', json={'topic': topic, 'click': site_url(), **msg}, timeout=20)
            print(f"Upozornenie: {msg['title']} -> {r.status_code}")
        except Exception as e:
            print(f'Upozornenie CHYBA {e}')


if __name__ == '__main__':
    for fn in (stats, gallery, calendar, notify):
        try:
            fn()
        except Exception as e:
            print(f'{fn.__name__}: CHYBA {e}')
