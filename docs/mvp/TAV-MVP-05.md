# TAV-MVP-05 — Tracking, timeline e riepiloghi email locali

## Perimetro

Implementazione sul commit `30426a1e5ad25d38ee022cef4c0682bb6d9e2f5d`, inizialmente
pulito e allineato a `origin/develop`. Qwik/Qwik City 1.20, un solo Worker e una
D1 condivisa. Nessun backend aggiunto, nuova dipendenza, deploy o risorsa cloud.
Un solo agente, attività e controlli seriali. TAV-MVP-06/07/08 non avviati.

Il cliente consulta un ordine tramite il token già introdotto in TAV-MVP-04.
La timeline è persistente; la creazione produce anche una richiesta durevole
di riepilogo email. Il solo adapter disponibile acquisisce file locali: **non
invia email**. Non esistono provider, code cloud, credenziali email, DNS, API
amministrative o avanzamenti automatici dell'ordine.

## Migrazione e ordini storici

`tavolyn-qwik/migrations/0004_tracking_outbox.sql` aggiunge:

| Tabella | Contratto |
| --- | --- |
| `order_events` | PK `(tenant_id,id)`, FK `(tenant_id,order_id)`, tipo, from/to status, visibilità PUBLIC/INTERNAL, attore nullable, UTC `created_at` |
| `email_outbox` | PK composita, FK ordine, tipo ORDER_SUMMARY, modalità, stato, tentativi, nome ristorante/timezone fotografati, date creazione/elaborazione, codice errore limitato |

Indice univoco parziale: un solo `ORDER_CREATED` per ordine. Indice timeline:
tenant/ordine/timestamp/id. Gli eventi sono append-only rispetto agli aggiornamenti.
L'outbox ha unicità `(tenant_id,order_id,message_type)` e indice per la selezione
locale dei pendenti. Errori memorizzati solo come codici, mai stack/SQL/token.

La migrazione inizializza ogni ordine precedente con `ORDER_CREATED`, `NEW`,
timestamp originale e attore nullo. Non inventa eventi di avanzamento: se lo
stato era stato modificato manualmente, resta invariato e non si ricostruiscono
transizioni sconosciute. Nome ristorante/timezone storici, prima non fotografati,
sono quelli disponibili al momento del backfill.

Per gli ordini precedenti l'outbox è **DISABLED_LEGACY / SUPPRESSED_LEGACY**.
Non viene processata dal sink e non deve mai diventare un arretrato da inviare.
I CHECK impediscono di rimetterla in QUEUED lasciando la modalità storica.
Non esiste modalità LIVE; SENT è dichiarato ma attualmente rifiutato da un CHECK.
Un futuro invio richiederà una migrazione e un opt-in espliciti per nuovi flussi,
preservando la soppressione degli ordini storici.

L'intero SQL è ripetibile (`IF NOT EXISTS`, insert con conflitti ignorati solo
per questo backfill). `npm run history:backfill` lo riesegue **soltanto in locale**:
niente cancellazioni, aggiornamenti di snapshot o sovrascrittura di effetti già
presenti. Le migrazioni 0001–0003 restano immutate.

## Atomicità e replay

Il batch D1 esistente viene esteso con evento iniziale e richiesta email:
ordine, articoli, accesso hash, evento, outbox e idempotenza sono una sola unità.
Nuovi effetti: `ORDER_CREATED/NEW/PUBLIC` e `ORDER_SUMMARY/LOCAL_ONLY/QUEUED`.
Non cambia la strategia di idempotenza né il calcolo economico di TAV-MVP-04.

Un fallimento in qualunque INSERT annulla tutto, incluse le nuove tabelle.
Il vincolo univoco idempotenza continua a risolvere le race concorrenti e il replay
legge il risultato esistente senza aggiungere eventi o messaggi. Un pagamento
simulato fallito non scrive nessuna delle sei entità. Non si usa un secondo Worker,
un job remoto o una transazione SQL BEGIN/COMMIT non supportata dal binding.

## Tracking API e sicurezza

**GET `/api/public/orders/:trackingToken`**, sullo stesso Worker.
La route dinamica nativa Qwik City risolve il tenant, verifica la forma del token,
calcola SHA-256 e cerca `(tenant_id,tracking_hash)` in `order_access` con join
tenant/ordine. Non serve la chiave HMAC per leggere un hash già autorizzato;
nessuna strategia alternativa o recupero tramite numero/email viene introdotta.

Token mancante, alterato, inesistente, numero ordine o token di altro tenant:
**404**, senza informazioni sull'esistenza di ordini altrui. Problema storage:
**503 TRACKING_UNAVAILABLE**, senza SQL o segreti. Altri metodi: 405/Allow GET
quando raggiungono il route handler. Query/header/body non selezionano il tenant.

DTO pubblico `TrackedOrder`:

```text
orderNumber, restaurant { name, slug }, createdAt, updatedAt,
status, fulfillment, paymentMethod, paymentStatus, currency,
subtotalCents, deliveryFeeCents, totalCents,
items [{ name, quantity, unitPriceCents, lineTotalCents,
         modifiers [{ label, deltaPriceCents }] }],
timeline [{ type, fromStatus, toStatus, occurredAt }]
```

Niente contatti cliente, indirizzo, note, ID prodotto/ordine/evento, attori staff,
hash, nonce o token restituito. Ogni query è parametrizzata e filtrata dal tenant.
Ordine/articoli/eventi vengono letti in un batch coerente. La timeline espone solo
eventi PUBLIC e una allowlist (`ORDER_CREATED`, `ORDER_STATUS_CHANGED`): eventi
interni e attori sono esclusi anche se un evento interno avesse visibilità PUBLIC.

API e pagina, comprese le risposte negative, usano `Cache-Control: no-store`,
`Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive`.
La pagina aggiunge meta robots/referrer e omette il canonical con il bearer.
Nessuna risorsa esterna, analytics o logger applicativo riceve il token.

Wrangler preview usa `--log-level warn` per evitare URL nei normali access log.
In configurazione sono disabilitati invocation log e trace automatiche, che
potrebbero registrare la URL completa; restano disponibili log applicativi
espliciti, senza dati sensibili. Questa è una scelta di privacy per route bearer:
un futuro deploy deve verificare anche eventuali log proxy/edge esterni, non
controllabili da questi header. Non è stato eseguito un deploy per verificarli.

## Pagina e conferma checkout

`/orders/:trackingToken/` usa un loader indipendente dal catalogo: gli acquisti
restano consultabili anche dopo modifiche dei prodotti. Mostra branding, numero,
stato effettivo, date nel timezone del ristorante, timeline cronologica, piatti,
importi, evasione e pagamento. Una creazione normale rimane `NEW`; non esistono
azioni staff o avanzamenti simulati.

Polling ogni **8 secondi**, con una sola richiesta per volta, soltanto quando
la pagina è visibile. Nascondere la pagina annulla timer/richiesta; tornare visibili
ricarica immediatamente. Nessun fetch duplicato all'apertura dopo il loader SSR.
Aggiornamenti identici non sostituiscono il riepilogo. Un 503/errore di rete
mantiene i dati precedenti con messaggio e retry; un 404 rimuove il riepilogo e
interrompe il polling. È presente anche un comando manuale di aggiornamento.

La conferma checkout usa il token della risposta in un segnale temporaneo e
mostra **Segui il tuo ordine**, anche dopo replay. Il riepilogo già salvato nella
scheda resta senza bearer. Una conferma ricaricata non recupera il link; il refresh
diretto della route tracking funziona dal suo URL. Non si salva il bearer in
localStorage, sessionStorage, cookie, response_json o D1 in chiaro. L'URL è una
credenziale: conservarlo privatamente; la cronologia del browser può contenerlo.

## Template e adapter email

`src/lib/server/email/summary-template.ts` definisce messaggio e interfaccia adapter.
Il template genera subject, testo e HTML deterministici dagli snapshot persistiti:
ristorante, numero/data, piatti, quantità, modificatori, importi, evasione, pagamento
e collegamento tracking. Il destinatario è soltanto l'email necessaria all'indirizzo
`to`: telefono, note e indirizzo del cliente non vengono copiati nel messaggio.
Nessuna lettura del catalogo corrente. HTML escapato; nessun asset remoto.

Terminologia: **riepilogo dell'ordine**, senza qualifiche fiscali o promesse di
pagamento reale. CASH indica pagamento non ancora avvenuto; MOCK_CARD indica
simulazione e assenza di addebito. Non compare una consegna email effettiva.

`outbox-service.ts` legge al massimo 20 richieste QUEUED/FAILED_LOCAL per tenant,
esclusivamente LOCAL_ONLY e demo marcati/abilitati. Ricostruisce il token HMAC
con la chiave esistente, ne verifica l'hash e genera il messaggio dagli snapshot.
Un errore produce solo `LOCAL_CAPTURE_FAILED`, `LOCAL_CAPTURE_CONFLICT` o
`TOKEN_KEY_UNAVAILABLE`. Non vengono stampati destinatario, URL o messaggio.

Semantica stati:

| Stato | Significato |
| --- | --- |
| QUEUED | Richiesta durevole da acquisire esplicitamente in locale |
| FAILED_LOCAL | Tentativo locale fallito; ripetibile dopo la correzione |
| CAPTURED_LOCAL | File acquisito; **non** spedito al destinatario |
| SUPPRESSED_LEGACY | Ordine storico escluso da cattura/invio |
| SENT | Riservato al futuro; nessun codice attuale lo imposta, CHECK lo vieta |

`scripts/local-email-sink.ts` scrive un file JSON per ID outbox con creazione
esclusiva (`wx`). Un file già esistente e identico viene riconosciuto, uno diverso
produce conflitto senza sovrascrittura. Questo consente il recupero dopo un crash
tra scrittura e aggiornamento D1: il retry non crea un secondo messaggio.
Il contatore misura i tentativi, non le consegne; `processed_at` è l'acquisizione.
Non ci sono lock durevoli che lascino una richiesta bloccata dopo un crash.

I file contengono destinatario e bearer: sono l'**eccezione esplicita delle
anteprime locali richiesta da questo task**, fuori dagli asset, sotto directory
ignorata da Git. File 0600/directory 0700 dove supportato; su Windows si ereditano
le ACL del workspace. Proteggere il workspace e non condividere questi file.
Non esistono endpoint per ispezionare, generare o scaricare messaggi.

## Procedura locale riproducibile

Node 22.16.0 / npm 10.9.2, dalla radice; su PowerShell usare `npm.cmd` se necessario:

```sh
npm ci
npm exec --workspace tavolyn-qwik -- playwright install chromium
npm run db:setup
npm run checkout:setup
npm run check
npm run cf:dev
```

Il setup applica quattro migrazioni e conserva gli ordini esistenti. La chiave
HMAC è la stessa di TAV-MVP-04: `.dev.vars` resta privato e non viene rigenerato.
Fermare preview manuali prima dei test/build. Nessun account o token cloud serve.
Creare un ordine dal menu e aprire il link della conferma. Il tracking può essere
ricaricato direttamente; provare anche il collegamento sul tenant sbagliato.

Per ripetere il solo backfill conservativo:

```sh
npm run history:backfill
```

Per acquisire i riepiloghi, procedura **esplicita locale**, dalla radice:

```sh
npm run email:capture -- --local --tenant aurora
npm run email:capture -- --local --tenant nodo
```

La CLI compila solo il proprio strumento in `.wrangler/email-sink/` e usa
`getPlatformProxy({ remoteBindings: false })` sui binding locali esistenti.
Non è un secondo server applicativo e non modifica `dist/`. Nessun listener HTTP
amministrativo o provider email viene avviato. I messaggi sono in:

```text
tavolyn-qwik/.wrangler/email-previews/aurora/<outbox-id>.json
tavolyn-qwik/.wrangler/email-previews/nodo/<outbox-id>.json
```

Aprire i JSON nel proprio editor per ispezionare `to`, `subject`, `text` e `html`;
non stamparli in log condivisi. I link puntano agli alias HTTP locali validati.
Se il preview usa una porta diversa, aggiungere `--port 8787` col valore effettivo
prima della prima cattura. Non cambiare chiave o contenuto dei file fra retry.
Ripetere il comando per altre richieste oltre il limite di 20; già acquisite e
storiche vengono saltate. Senza `--local` o tenant valido il comando è rifiutato.

Dal workspace, ispezione metadata senza destinatari o bearer:

```sh
npm exec -- wrangler d1 execute DB --local --command "SELECT status,delivery_mode,COUNT(*) AS count FROM email_outbox GROUP BY status,delivery_mode;"
```

## Verifiche

- **`npm run check`: exit 0**, typecheck, ESLint, build Workers dry run,
  **105 test Vitest e 29 test Playwright** passati, nessuno saltato.
  Bundle **252.71 KiB / gzip 72.27 KiB**, nessun upload. Log finale
  `.wrangler/TAV-MVP-05-check-final.log`.
- Rollback iniettato su articoli, eventi e outbox; controllo di tutte e sei le
  tabelle. Replay e cinque richieste simultanee conservano un solo effetto.
- Backfill ripetuto, snapshot ordini immutati, soppressione storici, FK composite,
  vincoli di unicità e rifiuto SENT.
- Tracking reale sul Worker: token valido/alterato/estraneo, nessuna enumerazione
  tramite numero, nessun contatto/ID interno/attore, filtro eventi interni,
  stato aggiornato da fixture D1 e refresh coerente.
- Template deterministico, HTML escapato, contanti/mock distinti; file sink vero,
  errore dopo scrittura prima dell'ack, retry senza duplicati e conflitto protetto.
- CLI provata: 8 acquisizioni Aurora e 5 Nodo nella prima prova, successive
  ripetizioni zero, nessun fallimento/invio reale. I vecchi ordini non acquisiti.
- Dopo l'intero gate e un ulteriore backfill, catture locali completate: **61
  ordini / 61 eventi / 61 richieste outbox**, quattro migrazioni registrate;
  **19 richieste storiche soppresse e 42 CAPTURED_LOCAL**, zero SENT. I dati
  preesistenti sono stati conservati, senza pulizia automatica degli ordini demo.
- Browser: quattro tracking desktop/mobile 1440/390 px; refresh, isolamento,
  storage senza bearer, nessun Referer nella navigazione successiva, polling
  con clock e visibilità controllati, pausa/ripresa ed errore temporaneo con retry.
  La visibilità nascosta è simulata nel test; non è una prova su dispositivo fisico.
  Il clock virtuale viene avanzato solo dopo un aggiornamento client osservabile,
  per non anticipare l'inizializzazione Qwik. Il caso è passato anche tre volte
  consecutive, senza sleep artificiali o retry automatici.
- Screenshot locali sotto `.wrangler/browser-results/`, rivisti visivamente;
  log soltanto sotto `.wrangler/`, entrambi ignorati. Le trace locali possono
  contenere bearer: trattarle come diagnostica privata, non pubblicarle.
- `npm run cf-typegen` riuscito, tipi invariati; `git diff --check` superato.
  Lockfile, migrazioni precedenti e configurazione ESLint invariati. Nessun SQL,
  riferimento `ORDER_TOKEN_KEY` o outbox nei bundle JavaScript client controllati.
- Audit: 10 segnalazioni note (8 moderate, 2 high), zero con `--omit=dev`.
  Nessun aggiornamento forzato; lo zero nel sottoinsieme dev escluso non certifica
  il bundle Qwik, che include parte delle dipendenze dichiarate di sviluppo.
- Controllati 106 file pubblicabili: nessun output, anteprima, database, log,
  screenshot o configurazione privata incluso. Nessuna corrispondenza ai pattern
  di chiavi/token controllati; verifica mirata, non certificazione generale.

## File principali e limiti

Nuova migrazione 0004; servizio/DTO tracking; route API/pagina dinamiche; polling
e CSS; estensione batch e link checkout; template/outbox e adapter/CLI locale;
script npm, policy log Wrangler/router head; test Vitest/Playwright; README e
contratti MVP. Nessuna modifica al lockfile o alle migrazioni precedenti.

Gli avanzamenti reali richiedono TAV-MVP-07; il tracking legge dati persistiti e
non li inventa. Un token non ha ancora scadenza applicativa: vale finché esiste
il record di accesso autorizzato; retention/revoca e anti-abuso restano gate del
futuro deploy. Non ci sono reset o pulizie automatiche. Il sink locale è l'unico
adapter; invio live e relativa protezione richiedono TAV-MVP-08 autorizzato.
Restano le advisory note Qwik/ESLint e la verifica CPU Workers Free in cloud.
Test locali non equivalgono a validazione cloud o Safari/device fisico.

Consegna Git su develop con firma disabilitata e push normale; SHA locale/remoto
nel resoconto finale. Nessun task successivo avviato.

## Riferimenti

- [D1 batch/rollback](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Wrangler getPlatformProxy](https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy)
- [Workers Logs e invocation log](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- Schema/tipi della versione installata Wrangler 4.162.0 e Qwik 1.20.
