# TAV-MVP-04 — Checkout ospite e ordini D1

## Perimetro

Base verificata `a9c772bf00046b9667483e688f2af9411b8ff851`, branch `develop`
pulito e allineato al remoto dopo fetch. Qwik/Qwik City 1.20, un Worker, D1 e
resolver hostname esistenti. Nessuna dipendenza aggiunta, migrazioni precedenti
preservate. Nessun backend parallelo, provisioning, billing o deployment pubblico.

Il cliente configura il carrello, riceve un preventivo autorevole e crea un
ordine realmente persistito. Sono supportati ritiro/consegna, contanti e carta
simulata. Non ci sono addebiti reali, dati bancari, invii email, tracking, timeline,
`order_events` o `email_outbox`. TAV-MVP-05 non è stato avviato.

## Schema incrementale

Migrazione `tavolyn-qwik/migrations/0003_checkout.sql`:

| Tabella | Dati e vincoli principali |
| --- | --- |
| `tenant_checkout_settings` | PK/FK tenant, modalità abilitate e tariffa consegna intera |
| `orders` | PK `(tenant_id,id)`, numero univoco nel tenant, stato, evasione, pagamento, valuta, importi interi, snapshot contatti/indirizzo, note, timestamp UTC |
| `order_items` | PK composita, FK composita all'ordine, prodotto storico, nome, quantità, modificatori e importi fotografati |
| `order_access` | PK/FK composita all'ordine, hash SHA-256 del token, nonce casuale, versione chiave, creazione |
| `idempotency_records` | PK `(tenant_id,operation,key_hash)`, hash richiesta, FK composita ordine, risposta senza bearer né contatti |

Gli indici iniziano con `tenant_id`. I CHECK distinguono pagamento simulato
riuscito da contanti non pagati, verificano quantità/importi interi, uguaglianza
dei totali, indirizzo obbligatorio in consegna e JSON valido. Gli articoli e i
campi commerciali dell'ordine non sono aggiornabili: trigger di immutabilità.
Lo stato operativo ha un campo separato, predisposto per i task futuri.

`order_items.product_id` è un riferimento storico fotografato, non una FK al
catalogo vivo: i vecchi acquisti devono sopravvivere a cambiamenti del catalogo.
L'appartenenza del prodotto è verificata dal servizio prima della scrittura;
la relazione articolo→ordine è invece protetta da FK tenant/ordine in D1.
Nessuna API pubblica modifica o legge ordini tramite questo ID storico.

Il numero visibile usa prefisso A/N e 12 caratteri casuali dall'UUID dell'ordine,
con unicità D1. Non è un contatore né una credenziale. Un'eventuale collisione
fallisce atomicamente; riprovare con la stessa chiave è sicuro.

`seeds/demo-checkout.sql` inserisce solo i due tenant noti marcati demo:
ritiro gratuito, consegna **350 centesimi Aurora / 450 Nodo**, entrambe abilitate.
`ON CONFLICT DO NOTHING`: nessun duplicato, reset o sovrascrittura di edit manuali.

## Preventivazione autorevole

`POST /api/public/quote`, JSON same-origin:

```json
{
  "items": [{ "productId": "<id dal menu>", "modifierIds": ["<id impasto>"], "quantity": 2 }],
  "fulfillment": "PICKUP"
}
```

Il contesto tenant viene dal resolver, mai da body/query/header personalizzati.
Il servizio legge catalogo e tariffe D1 con parametri bindati, applica le stesse
funzioni `configurationError`/`configuredPrice` del menu su dati server e controlla
appartenenza, disponibilità, opzioni, min/max e quantità. Prezzi, stati e totali
eventualmente inviati dal client sono ignorati. Tutti gli importi sono centesimi
interi e la valuta proviene dal tenant (fixture EUR).

Risposta: `currency`, `fulfillment`, `items` con nomi, opzioni e prezzi fotografati,
`subtotalCents`, `deliveryFeeCents`, `totalCents`, `quoteFingerprint` SHA-256 del
preventivo. Il fingerprint non firma un prezzo del browser: serve a confrontare
la scelta visualizzata con il nuovo calcolo D1 alla creazione.

Prodotto rimosso, estraneo, esaurito o selezione non più valida: **409 CART_CHANGED**.
Una variazione economica o dei nomi rispetto al preventivo: **409 QUOTE_CHANGED**
alla conferma, con invito ad aggiornare. Il prezzo storico nel carrello non viene
mai considerato un'autorizzazione a comprare a quel prezzo.

Limiti: 32 KiB effettivamente letti dal body con reader a dimensione controllata,
1–50 configurazioni, 1–99 unità per riga, massimo 100 unità complessive, 100 ID
modificatori per riga, niente duplicati e totale massimo 200.000 centesimi.
Nome 2–100 caratteri, email fino a 254, telefono 5–30, note fino a 500 con newline
normalizzati, indirizzo fino a 200 e città fino a 100, CAP italiano di 5 cifre.
Non sono implementate aree geografiche, listini, promozioni o fiscalità.

## Ordine e pagamenti

`POST /api/public/orders`, JSON same-origin:

```json
{
  "idempotencyKey": "<UUID v4 generato una sola volta per la richiesta>",
  "cart": { "items": [{ "productId": "<id dal menu>", "modifierIds": ["<id impasto>"], "quantity": 2 }] },
  "fulfillment": "PICKUP",
  "quoteFingerprint": "<64 caratteri esadecimali restituiti dal preventivo>",
  "contact": { "name": "Ospite Demo", "email": "ospite@example.test", "phone": "+39 000 000 0000" },
  "address": null,
  "paymentMethod": "MOCK_CARD",
  "mockPaymentResult": "SUCCESS",
  "notes": "Dati interamente fittizi"
}
```

Per `DELIVERY`, `address` richiede `street`, `city`, `postalCode`. Per `CASH`,
`mockPaymentResult` viene normalizzato a null. Stato iniziale `NEW`.
`MOCK_CARD/SUCCESS` → `PAID_SIMULATED`; `MOCK_CARD/FAILURE` → **402** senza
nessuna scrittura. `CASH` → `UNPAID`, nessun anticipo. Nessun PAN, scadenza, CVV
o altro dato bancario viene chiesto, utilizzato o salvato.

Risposta iniziale **201**, replay **200**: numero ordine, riepilogo e importi,
stato ordine/pagamento, modalità, timestamp UTC e `trackingToken` opaco.
Nessun ID interno, contatto, link di tracking inesistente o promessa email.
Errori applicativi: `{ error: { code, message, requestId } }`, senza SQL/stack.
Risposte `no-store`, `nosniff`, `Referrer-Policy: no-referrer`.
Metodi diversi da POST → 405/`Allow: POST` quando raggiungono la route.

Gli endpoint richiedono `Content-Type: application/json` e `Origin` uguale
all'origine della Request, e rifiutano `Sec-Fetch-Site: cross-site`. Restano
attive le protezioni native Qwik City. Per prove CLI aggiungere esplicitamente
l'header Origin, oltre all'eventuale `curl --resolve` per gli alias locali.

## Transazione e idempotenza

Le query preparate di scrittura sono eseguite in **un solo `DB.batch()`**:
ordine → articoli → accesso hash → record idempotenza. Il vincolo univoco
tenant/operazione/hash chiave è obbligatorio; non si usa `ON CONFLICT IGNORE`
per aggirarlo. Se una scrittura fallisce, D1 annulla tutta la sequenza.

La lettura preliminare accelera i replay, ma non decide la correttezza della
concorrenza: due richieste simultanee possono superarla, poi una sola vince il
vincolo nel batch. La perdente legge il record vincente dopo il rollback:
stesso hash richiesta → stessa risposta economica; differente → **409
IDEMPOTENCY_CONFLICT**. In assenza di un vincitore l'errore è **503 ORDER_NOT_SAVED**,
senza ordine parziale. Si può riprovare la stessa chiave anche senza conoscere
l'esito HTTP precedente.

La chiave UUID v4 è memorizzata soltanto come hash SHA-256. L'hash della richiesta
usa il comando validato e normalizzato: selezioni/righe ordinate, contatti
normalizzati, campi effettivi di evasione e pagamento. I campi extra ignorati
non cambiano il comando. Cambiare quantità, contatti, note, modalità o fingerprint
con la stessa chiave genera conflitto. L'operazione è `CREATE_ORDER`.

Un replay viene recuperato prima di interrogare il catalogo: prezzi modificati
o disponibilità successiva non alterano un ordine già creato. Una nuova richiesta
ricalcola sempre da D1. Il fallimento simulato non riserva una chiave: non esiste
alcun ordine da recuperare per quel tentativo. Le letture catalogo precedono il
batch di scrittura; non si prenotano scorte né si implementa gestione concorrente
di un catalogo amministrativo, che non ha endpoint in questo task.

## Token di tracking e chiave privata

Il token è l'output a 256 bit di HMAC-SHA-256, codificato base64url, su dominio
versionato, tenant, UUID ordine e nonce casuale di 32 byte. La chiave server
`ORDER_TOKEN_KEY` è privata, casuale, di 32 byte (64 caratteri hex). Il token non
è derivabile dal solo numero ordine o dal solo contenuto D1.

In D1 si salvano soltanto `tracking_hash = SHA-256(token)`, nonce non segreto e
`key_version = 1`. `response_json` contiene il riepilogo senza bearer. Sul replay
il server ricostruisce lo stesso token con la chiave privata e ne verifica l'hash.
Una chiave assente, invalida o sostituita produce 503, senza emettere credenziali
errate né creare un altro ordine. Conservare la chiave: non ruotarla manualmente.
Una futura rotazione richiederà gestione esplicita delle versioni storiche.

Il client non salva il token in local/session storage e non costruisce link
di tracking. La futura pagina anonima potrà verificare il suo hash nel tenant;
la sua implementazione appartiene a TAV-MVP-05.

## Checkout e recupero nel browser

Route `/checkout/` nel layout shop esistente, con stessi temi, riepilogo aggiornato,
form accessibile, campi indirizzo condizionali e scelta dell'esito mock. Quote
caricate dal server con annullamento delle richieste precedenti, stati pending,
errori e pulsante di aggiornamento. Conferma disabilitata durante l'invio e fino
al preventivo valido. Dati contatto dichiaratamente fittizi; nessuna registrazione.

Al primo invio si crea un UUID v4 e si salva il comando completo nella
`sessionStorage` della scheda, sotto `tavolyn:checkout:pending:v1:<slug>`.
Contiene i contatti demo solo finché l'esito è incerto, per poter ritrasmettere
esattamente la stessa richiesta dopo refresh. Il form resta bloccato e propone
il retry; non viene generata automaticamente una chiave nuova dopo errori di rete
o 5xx. Gli errori di validazione/pagamento consentono invece una correzione.

Dopo successo il pending viene rimosso, il carrello svuotato e si conserva soltanto
un riepilogo senza contatti o token in `tavolyn:checkout:receipt:v1:<slug>`.
La conferma ricaricata è questa copia locale: non legge lo stato operativo futuro
da D1 e non sostituisce il tracking. Un nuovo carrello avvia un nuovo checkout.
Storage disabilitato: avviso esplicito, retry possibile nella pagina corrente,
nessuna promessa di recupero dopo chiusura/refresh. Separazione per origine e slug.

## Procedura locale riproducibile

Node 22.16.0 e npm 10.9.2. Dalla radice (PowerShell: `npm.cmd` se necessario):

```sh
npm ci
npm exec --workspace tavolyn-qwik -- playwright install chromium
npm run db:setup
npm run checkout:setup
npm run cf-typegen
npm run check
npm run cf:dev
```

`db:setup` applica tre migrazioni e tre seed, sempre **`--local`**. Ripeterlo è
non distruttivo. `checkout:setup` crea `tavolyn-qwik/.dev.vars` con flag esclusivo
solo se non esiste, usando `randomBytes(32)`: non legge, stampa o sovrascrive
configurazioni private preesistenti. Nessun account, username o login cloud.

Se `.dev.vars` esiste già e manca la variabile, il proprietario deve aggiungere
una riga `ORDER_TOKEN_KEY=<64 caratteri hex casuali>` nel proprio editor, senza
pubblicarla. Per generarla localmente senza stamparla, dal workspace si può usare
questo comando **solo una volta e solo se la variabile è assente**:

```sh
node --input-type=module -e "import {randomBytes} from 'node:crypto'; import {appendFileSync} from 'node:fs'; appendFileSync('.dev.vars', '\nORDER_TOKEN_KEY='+randomBytes(32).toString('hex')+'\n');"
```

Non sostituire una chiave già usata. Conservare un backup privato del file se
si vuole mantenere il replay degli ordini locali. Wrangler dichiara solo il nome
in `secrets.required`; `Env` è rigenerato. La chiave non è in `vars`, Git o bundle.
Il test harness usa una chiave effimera per la propria D1 isolata. Playwright
esegue il setup locale conservativo prima del preview. Fermare `dev`/`cf:dev`
manuali prima di build/test: non devono ricompilare la stessa `dist/` né occupare 8787.

Aprire `http://aurora.localhost:8787/menu/` o `http://nodo.localhost:8787/menu/`,
aggiungere un piatto, aprire carrello e checkout. Provare carta simulata fallita,
successo, contanti, consegna e refresh della conferma. Nessun invio email.
Lo stato locale D1 e la configurazione privata restano sotto il workspace.

## Verifiche eseguite

- **`npm run check`: exit 0** nella verifica finale, con typecheck, lint, build
  Qwik/Workers dry run, **97 test Vitest** e **22 test Chromium**. Nessun test saltato.
- Nuovi test D1/Worker: tariffe tenant, supplementi/quantità, prezzi client
  ignorati, limiti, input ostili, prodotti estranei/esauriti, vincoli modificatori,
  snapshot immutabili, contanti, fallimento mock senza scritture, cinque richieste
  concorrenti uguali, race con payload diversi, rollback con errore iniettato
  nell'INSERT articolo, replay dopo variazioni catalogo/interruzione, FK tenant
  e assenza del bearer nel record idempotenza.
- Nuovi test browser: Aurora/Nodo a 1440/390 px, pickup mock/cash delivery,
  form e conferma, totale autorevole, refresh, carrello vuoto, validazione form,
  fallimento e retry; risposta interrotta dopo commit e replay 200 dopo refresh.
- Il test di interruzione usa l'alias Aurora `127.0.0.1`: `route.fetch` usa DNS
  Node, che non applica la risoluzione `.localhost` di Chromium. Nessun bypass
  hostname o mock degli handler. I casi di race usano concorrenza solo all'interno
  del test richiesto; nessun agente o task parallelo.
- Screenshot locali di form e conferma desktop/mobile in
  `tavolyn-qwik/.wrangler/browser-results/`, esclusi da Git, rivisti visivamente.
- Bundle finale: **259.51 KiB, gzip 74.12 KiB**, nessun upload. Log del gate:
  `tavolyn-qwik/.wrangler/TAV-MVP-04-check-final.log`.
- Query Wrangler locale: tre migrazioni registrate, due configurazioni tariffa,
  18 ordini demo effettivamente persistiti dalle prove browser (non cancellati).
  Tariffe 350/450 centesimi confermate. La D1 del test harness è separata.
- `npm audit --json`: 10 segnalazioni note, 8 moderate e 2 high, exit 1;
  `npm audit --omit=dev`: zero, exit 0. Nessun aggiornamento forzato. Lo zero
  senza dev non certifica la sicurezza del bundle Qwik.
- `git diff --check` superato; lockfile e migrazioni 0001/0002 invariati.
  `.dev.vars` verificato ignorato. Nessuna query SQL o riferimento alla chiave
  privata nei bundle JavaScript client controllati.
- Revisionati 94 file pubblicabili: nessun database locale, build, log, trace,
  screenshot o configurazione privata tra i candidati. Nessuna corrispondenza ai
  pattern di chiavi private, token e chiavi HMAC in chiaro controllati; controllo
  mirato, non certificazione di assenza di ogni possibile segreto.

## File e limiti residui

Migrazione/seed checkout; moduli `src/lib/server/checkout/{validation,crypto,
quote-service,order-service,http}.ts`; DTO `src/lib/shared/checkout.ts`; route
API quote/orders; route checkout e CTA carrello; CSS; script setup, package script,
config/tipi Wrangler; suite Vitest/Playwright e fixture precedenti; README e
contratti MVP collegati. Il lockfile non cambia.

Sono test locali in workerd/Chromium, non un deploy pubblico o un device fisico.
Le advisory Qwik/ESLint note restano da risolvere compatibilmente; nessun update
forzato. CPU Workers Free da verificare su un futuro deploy autorizzato.
Prima della pubblicazione servono i task anti-abuso/rate limit, protezione email
e retention: non esistono reset automatici o pulizia degli ordini locali; usare
solo dati fittizi. Le trace diagnostiche locali possono contenere richieste demo
e relative credenziali: sono private e ignorate, non materiale da pubblicare.

La consegna prevede commit con firma disabilitata e push normale su `develop`,
con confronto SHA remoto nel resoconto finale. Nessun task successivo avviato.

## Riferimenti verificati

- [D1 Database: batch e rollback](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Workers: segreti e configurazione locale](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers: Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- Tipi e schema delle versioni installate, test sul runtime Wrangler 4.162.0.
