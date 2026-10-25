// Sem vlož odkazy na zverejnené hárky Google tabuľky (Súbor > Zdieľať > Zverejniť na webe > CSV).
// Kým sú prázdne, tréningy a aktuality sa berú zo súborov treningy.txt a aktuality.txt.
const TRENINGY_CSV = '';
const AKTUALITY_CSV = '';

// Adresa Cloudflare Workera pre živé výsledky (napr. 'https://tjklas.tvojemeno.workers.dev').
// Kým je prázdna, detail zápasu ide z údajov na GitHube (obnova cca každú hodinu, cez víkend každých 15 minút).
const PROXY_URL = 'https://tjklas.v8kjgs4tmc.workers.dev';

// Téma pre upozornenia v appke ntfy (ntfy.sh). Hráči ju zadajú v ntfy pri odoberaní.
// Ak ju zmažeš (nechaj ''), upozornenia sa prestanú posielať.
const NTFY_TOPIC = 'tjklas-besa-21ea56';

// Po koľkých žltých kartách má hráč stop (pozri rozpis súťaže ObFZ Levice). 0 = neupozorňovať.
const ZLTE_STOP = 0;
