import re
import stiahni as S
for u in ['https://sportnet.sme.sk/futbalnet/z/zsfz/s/vi-liga-stred-macron-yoursport-zsfz/timy/','https://sportnet.sme.sk/futbalnet/z/zsfz/s/vi-liga-stred-macron-yoursport-zsfz/',
          'https://sportnet.sme.sk/futbalnet/k/tj-fo-martin-nad-zitavou/', S.TEAM_URL+'program/']:
    try: soup=S.get(u)
    except Exception as e: print('ERR',u,e); continue
    print('=====',u)
    seen=set()
    for a in soup.find_all('a', href=re.compile(r'/futbalnet/k/')):
        t=S.clean(a)
        if t and t not in seen and re.search(r'(?i)volkov|vion|moravc|martin|tekov|hurban', t+a.get('href','')): seen.add(t); print('  K', a.get('href'), '|', t)
    for a in soup.find_all('a', href=re.compile(r'/zapas/')):
        print('  Z', re.sub(r'\s+',' ',a.get_text(' '))[:150])
