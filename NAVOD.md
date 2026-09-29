# TJ Klas Beša – webová appka pre hráčov

## 1. GitHub
1. Založ si účet na github.com.
2. Vpravo hore **+ → New repository**. Názov napr. `tjklas`, zvoľ **Public**, potvrď **Create repository**.
3. Na stránke repozitára klikni na **uploading an existing file** a myšou pretiahni **celý obsah** rozbaleného priečinka (aj priečinok `.github`). Dole klikni **Commit changes**.
   - Ak by sa priečinok `.github` nenahral: **Add file → Create new file**, do názvu napíš `.github/workflows/stranka.yml` a vlož obsah toho súboru.
4. **Settings → Pages → Source:** vyber **GitHub Actions**.
5. **Actions → Ligy a stránka → Run workflow**. Po 1–2 minútach je appka na adrese
   `https://TVOJE-MENO.github.io/tjklas/`
   (Prvý beh po nahratí súborov môže zlyhať, ak ešte nebol nastavený krok 4. Stačí ho spustiť znova.)

Ligy sa potom sťahujú samy každé 3 hodiny, cez víkend popoludní každých 30 minút.

## 2. Google tabuľka (tréningy a aktuality)
1. Otvor sheets.new.
2. **Súbor → Importovať → Nahrať** súbor `sablony/treningy.csv`, zvoľ **Nahradiť aktuálny hárok**. Hárok premenuj na `Tréningy`.
3. Pridaj druhý hárok (+ vľavo dole), pomenuj ho `Aktuality` a rovnako doň importuj `sablony/aktuality.csv`.
4. **Súbor → Zdieľať → Zverejniť na webe**. Vyber hárok **Tréningy**, formát **Hodnoty oddelené čiarkami (.csv)**, klikni **Zverejniť** a skopíruj odkaz. To isté sprav pre hárok **Aktuality**.
5. Na GitHube otvor súbor `nastavenie.js`, klikni na ceruzku a vlož oba odkazy medzi úvodzovky. Ulož cez **Commit changes**.

Dátumy píš ako `4.10.2026`, čas ako `17:30`. Po úprave tabuľky sa zmena v appke ukáže do pár minút (Google zverejnený hárok chvíľu drží v pamäti).
Vedeniu stačí tabuľku zdieľať s právom upravovať.

## 3. Hráčom
Pošli im odkaz. Na iPhone: Safari → Zdieľať → Pridať na plochu. Na Androide: Chrome → ⋮ → Pridať na plochu / Inštalovať.

## Ďalšie ligy
V súbore `ligy.json` na GitHube pridaj riadok podľa vzoru (id, názov, odkaz na súťaž zo Sportnetu).

## Keď niečo nejde
V záložke **Actions** otvor posledný beh a krok „Stiahnuť ligy zo Sportnetu". Pri každej lige je vypísané, koľko tímov a zápasov našiel, alebo chyba.
