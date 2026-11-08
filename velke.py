"""Veľké európske ligy z football-data.org (bezplatný kľúč v secrete FOOTBALL_DATA_KEY).

Zapíše data/velke.json v rovnakom tvare ako ligy.json, aby ich vedeli použiť hry (simulácia sezóny a zápasu).
Sťahuje najviac raz za 3 hodiny, bezplatný limit je 10 dopytov za minútu.
"""
import datetime
import json
import os
import sys
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

DATA = Path(__file__).parent / 'data'
OUT = DATA / 'velke.json'
TZ = ZoneInfo('Europe/Bratislava')
API = 'https://api.football-data.org/v4'
LIGY = [
    # kód, názov, horná zóna (popis, počet), zostup (počet)
    ('PL', 'Premier League (Anglicko)', ('Liga majstrov', 4), 3),
    ('ELC', 'Championship (Anglicko 2)', ('Postup', 2), 3),
    ('BL1', 'Bundesliga (Nemecko)', ('Liga majstrov', 4), 2),
    ('FL1', 'Ligue 1 (Francúzsko)', ('Liga majstrov', 3), 2),
    ('SA', 'Serie A (Taliansko)', ('Liga majstrov', 4), 3),
    ('PD', 'La Liga (Španielsko)', ('Liga majstrov', 4), 3),
]
MAX_AGE = 3 * 3600


def get(path, key):
    for pokus in range(3):
        r = requests.get(API + path, headers={'X-Auth-Token': key}, timeout=30)
        if r.status_code == 429:  # limit dopytov – chvíľu počkať
            time.sleep(65)
            continue
        if r.status_code in (401, 403):
            raise PermissionError(f'{r.status_code} {r.text[:200]}')
        r.raise_for_status()
        time.sleep(6.5)  # najviac 10 dopytov za minútu
        return r.json()
    raise RuntimeError('príliš veľa pokusov')


def name(t):
    return (t or {}).get('shortName') or (t or {}).get('name') or '?'


def liga(code, nazov, top, zostup, key):
    st = get(f'/competitions/{code}/standings', key)
    tab = next((s for s in st.get('standings', []) if s.get('type') == 'TOTAL'), None) or {'table': []}
    teams = [{
        'pos': r['position'], 'name': name(r['team']),
        'z': r['playedGames'], 'v': r['won'], 'r': r['draw'], 'p': r['lost'],
        'g': f"{r['goalsFor']}:{r['goalsAgainst']}", 'b': r['points'],
    } for r in tab['table']]
    ma = get(f'/competitions/{code}/matches', key)
    matches = []
    for m in ma.get('matches', []):
        if m.get('status') in ('CANCELLED',):
            continue
        dt = datetime.datetime.fromisoformat(m['utcDate'].replace('Z', '+00:00')).astimezone(TZ)
        ft = (m.get('score') or {}).get('fullTime') or {}
        done = m.get('status') == 'FINISHED'
        matches.append({
            'id': str(m['id']), 'round': m.get('matchday'),
            'home': name(m['homeTeam']), 'away': name(m['awayTeam']),
            'hs': ft.get('home') if done else None, 'as': ft.get('away') if done else None,
            'date': dt.strftime('%Y-%m-%d'), 'time': dt.strftime('%H:%M'),
        })
    strelci = {}
    try:
        sc = get(f'/competitions/{code}/scorers?limit=100', key)
        for s in sc.get('scorers', []):
            strelci.setdefault(name(s.get('team')), {})[s['player']['name']] = s.get('goals') or 0
    except Exception as e:  # strelci nemusia byť v bezplatnej verzii
        print(f'  {code}: strelci nedostupní ({e})')
    season = (ma.get('filters') or {}).get('season') or (st.get('season') or {}).get('startDate', '')[:4]
    return {
        'id': 'v-' + code.lower(), 'name': nazov, 'velka': True, 'season': str(season),
        'at': datetime.datetime.now(TZ).isoformat(timespec='seconds'),
        'zona': {'top': top[0], 'n': top[1], 'zostup': zostup},
        'teams': teams, 'matches': matches, 'strelci': strelci,
    }


def main():
    key = os.environ.get('FOOTBALL_DATA_KEY', '').strip()
    if not key:
        print('Veľké ligy: chýba FOOTBALL_DATA_KEY, preskakujem.')
        return
    old = {}
    try:
        old = json.loads(OUT.read_text(encoding='utf-8'))
    except Exception:
        pass
    at = old.get('at')
    if at and '--force' not in sys.argv:
        age = (datetime.datetime.now(TZ) - datetime.datetime.fromisoformat(at)).total_seconds()
        if age < MAX_AGE:
            print(f'Veľké ligy: aktuálne ({int(age / 60)} min), preskakujem.')
            return
    prev = {l['id']: l for l in old.get('ligy', [])}
    out = []
    for code, nazov, top, zostup in LIGY:
        try:
            l = liga(code, nazov, top, zostup, key)
            print(f"Veľké ligy: {code} – {len(l['teams'])} tímov, {len(l['matches'])} zápasov, strelci {sum(len(v) for v in l['strelci'].values())}")
            out.append(l)
        except PermissionError as e:
            print(f'::error::football-data.org odmietol kľúč: {e}')
            return
        except Exception as e:
            print(f'Veľké ligy: {code} CHYBA {e}')
            if 'v-' + code.lower() in prev:
                out.append(prev['v-' + code.lower()])
    if out:
        DATA.mkdir(exist_ok=True)
        OUT.write_text(json.dumps({'at': datetime.datetime.now(TZ).isoformat(timespec='seconds'), 'ligy': out}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


if __name__ == '__main__':
    main()
