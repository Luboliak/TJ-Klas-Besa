import re, requests
from bs4 import BeautifulSoup
import stiahni as S
B='https://sportnet.sme.sk/futbalnet/z/zsfz/s/halovy-turnaj-o-pohar-predsedu-zsfz/'
for u in [B, B+'tabulky/', B+'program/', B+'vysledky/', B+'timy/', S.TEAM_URL+'program/']:
    try: soup=S.get(u)
    except Exception as e: print('ERR',u,e); continue
    print('=====',u)
    for a in soup.find_all('a', href=re.compile(r'/zapas/')):
        print('  Z', a.get('href'), '|', re.sub(r'\s+',' ',a.get_text(' '))[:160])
    for a in soup.find_all('a', href=re.compile(r'part=|skupina', re.I))[:20]:
        print('  P', a.get('href'), '|', S.clean(a))
    for i,tb in enumerate(soup.find_all('table')):
        names=[S.clean(a) for a in tb.find_all('a', href=re.compile(r'/futbalnet/k/'))]
        print('  T',i, names)
    for t in soup.find_all(string=re.compile(r'Skupina|hala|Hala|miesto', re.I))[:15]:
        print('  S', t.strip()[:120])
