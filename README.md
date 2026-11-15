# Tavolyn

Demo portfolio Qwik 1.20 / Qwik City su **un solo Cloudflare Worker**.
Il workspace `tavolyn-qwik/` serve due ristoranti fittizi, **Trattoria Aurora** e
**Nodo Pizza Lab**, leggendo configurazioni e hostname da una sola D1 condivisa.
Sono implementati runtime, tenant, branding, catalogo, carrello e checkout ospite
con ordini D1, tracking e riepiloghi email acquisibili solo localmente (TAV-MVP-01–05).
Invio email reale e autenticazione restano ai task successivi. Tutti i pagamenti
sono dimostrativi, senza addebiti reali.

## Installazione e avvio locale

Servono Node.js **22.16.0** e npm **10.9.2**. Dalla radice del repository:

```sh
npm ci
npm exec --workspace tavolyn-qwik -- playwright install chromium
npm run db:setup
npm run checkout:setup
npm run check
npm run cf:dev
```

Su Windows usare `npm.cmd` se PowerShell intercetta `npm.ps1`. L'installazione
Chromium serve per i test browser ed è necessaria solo al primo uso o dopo
l'aggiornamento di Playwright. Non servono login, account Cloudflare/AWS,
credenziali, database remoti o servizi a pagamento.

Con Wrangler attivo:

- <http://aurora.localhost:8787/> — Trattoria Aurora.
- <http://nodo.localhost:8787/> — Nodo Pizza Lab.
- <http://127.0.0.1:8787/> e <http://localhost:8787/> — alias locali di Aurora.
- `/api/public/site` — configurazione pubblica del ristorante risolto.
- `/menu/` — catalogo D1, categorie e piatti personalizzabili.
- `/cart/` — carrello persistente nel browser, separato per ristorante.
- `/api/public/menu` — catalogo pubblico con prezzi in centesimi e disponibilità.
- `/checkout/` — preventivo autorevole, ritiro/consegna, pagamento simulato o contanti.
- `POST /api/public/quote` e `POST /api/public/orders` — preventivo e ordine idempotente.
- `/orders/:trackingToken/` e `GET /api/public/orders/:trackingToken` — stato e timeline riservati al possessore del collegamento.
- <http://127.0.0.1:8787/api/health> — liveness indipendente da tenant e D1.

Chromium risolve i nomi `.localhost` verso il loopback, senza DNS pubblico. In
caso di client che non lo supportano, per una verifica HTTP si può usare:

```sh
curl --resolve aurora.localhost:8787:127.0.0.1 http://aurora.localhost:8787/api/public/site
curl --resolve nodo.localhost:8787:127.0.0.1 http://nodo.localhost:8787/api/public/site
curl -i http://127.0.0.1:8787/api/health
```

Su Windows PowerShell usare `curl.exe`. Health risponde HTTP 200, JSON
`{"status":"ok","service":"tavolyn"}`, con `Cache-Control: no-store`.
Un hostname sconosciuto produce 404 sulle route applicative;
health e asset condivisi non richiedono un tenant.

I comandi di sviluppo abilitano esplicitamente gli alias locali. La configurazione
base ha `LOCAL_DEMO_MODE=false`: query, cookie e header non possono attivare tale
modalità o cambiare tenant. Le due pagine hanno anche collegamenti locali di
navigazione, visibili solo in questa modalità.

## Comandi dalla radice

| Comando                | Scopo                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| `npm ci`               | Installazione dal lockfile condiviso                                        |
| `npm run db:migrate`   | Applica solo le migrazioni D1 locali non ancora registrate                  |
| `npm run db:seed`      | Inserisce i fixture mancanti senza duplicare o sovrascrivere righe          |
| `npm run db:setup`     | Migrazioni e seed locali, in sequenza                                       |
| `npm run checkout:setup` | Crea la chiave privata locale se `.dev.vars` non esiste, senza stamparla |
| `npm run history:backfill` | Ripete l'inizializzazione conservativa delle timeline; vecchie email soppresse |
| `npm run email:capture -- --local --tenant aurora` | Acquisisce fino a 20 riepiloghi locali Aurora, senza invio reale; `nodo` per l'altro tenant |
| `npm run cf-typegen`   | Rigenera `Env` dai binding Wrangler                                         |
| `npm run typecheck`    | TypeScript strict per sorgenti, configurazioni e test                       |
| `npm run lint`         | ESLint per sorgenti, configurazioni e test                                  |
| `npm run build`        | Build Qwik e bundle Wrangler in dry run, senza upload                       |
| `npm test`             | Integrazione su Worker compilato e D1 isolata; richiede una build           |
| `npm run test:browser` | Verifiche Chromium di homepage, menu e carrello; richiede build e Chromium |
| `npm run check`        | Typecheck, lint, build, integrazione e browser, in sequenza                 |
| `npm run cf:dev`       | Build iniziale e avvio Wrangler locale con binding D1                       |
| `npm run dev`          | Alias di `cf:dev`                                                           |
| `npm run preview`      | Avvio dell'ultima build su Wrangler, porta 8787                             |
| `npm run dev:vite`     | Authoring HMR, porta 5173, con gli stessi dati D1 locali                    |
| `npm run benchmark`    | Profiling locale sul preview già attivo                                     |

`npm run check` avvia e arresta il proprio preview per i test browser, usando
un solo processo di test. Prima fermare eventuali preview manuali sulla porta 8787. Il setup browser ripete `db:setup`, che conserva i dati già presenti.
Le schermate e le trace rimangono in `.wrangler/browser-results/`, ignorata da Git.

Per una modifica: fermare preview, eseguire `npm run check`, poi riavviare
`npm run preview`. Non ricostruire `dist/` durante il profiling. Arrestare i server
manuali con Ctrl+C. Vite è uno strumento di authoring; la verifica runtime usa
Wrangler/workerd.

`cf:dev` esegue prima la build (che usa Vite come compilatore), poi avvia
`wrangler dev --local` sulla porta 8787. Il server applicativo è quindi workerd,
con il binding `DB` e lo stesso stato locale utilizzato da migrazioni e seed.
`dev:vite` avvia invece l'authoring HMR sulla porta 5173. Dopo una modifica,
riavviare `cf:dev` per ricompilare il Worker; il comando non abilita HMR né applica
automaticamente le migrazioni. Eseguire prima `npm run db:setup` quando necessario.

## Struttura e documentazione

Le pagine sono in `src/routes/`, gli endpoint in `src/routes/api/`, la logica
server in `src/lib/server/` e i soli contratti pubblici in `src/lib/shared/`.
Le future pagine gestionali potranno usare `src/routes/app/` nello stesso Worker.
Il database è esposto a Qwik City come `RequestEvent.platform.env.DB`.
`db:setup` applica quattro migrazioni (inclusa `0004_tracking_outbox.sql`) e i seed dei due menu e delle tariffe, senza eliminare
righe o sovrascrivere modifiche esistenti. Su un database demo inizializzato:
10 categorie, 27 prodotti, 19 gruppi modificatori e 56 modificatori.
Il carrello conserva solo ID, selezioni e quantità in `localStorage`. Il checkout
ricalcola i prezzi su D1 e salva ordine, snapshot e idempotenza atomicamente.
La chiave `ORDER_TOKEN_KEY` resta in `tavolyn-qwik/.dev.vars`, ignorato da Git:
non cancellarla o rigenerarla, perché serve a ricostruire i token nei retry.
Se il file esiste già, `checkout:setup` lo conserva senza leggerlo o modificarlo;
seguire il runbook TAV-MVP-04 per integrare una configurazione privata esistente.
Il tracking si apre dalla conferma dell'ordine, anche dopo un replay, e si può
ricaricare dal suo URL. Il token non è salvato nel browser: conserva privatamente
il collegamento. I riepiloghi email locali sono file JSON in
`tavolyn-qwik/.wrangler/email-previews/<tenant>/`, fuori dagli asset pubblici e
ignorati da Git. Non sono email inviate. Gli ordini storici restano esclusi dalle
catture e da eventuali futuri invii. Consultare TAV-MVP-05 per ispezione e limiti.

- [Specifiche MVP autorevoli](docs/mvp/README.md).
- [TAV-MVP-05: tracking, timeline, outbox e sink locale](docs/mvp/TAV-MVP-05.md).
- [TAV-MVP-04: checkout, atomicità, idempotenza e setup privato locale](docs/mvp/TAV-MVP-04.md).
- [TAV-MVP-03: catalogo, API, carrello e verifiche](docs/mvp/TAV-MVP-03.md).
- [TAV-MVP-02: schema, tenancy, seed, prove e limiti](docs/mvp/TAV-MVP-02.md).
- [TAV-MVP-01: bootstrap e verifica storica](docs/mvp/TAV-MVP-01.md).

Stato D1 locale e output generati risiedono sotto `tavolyn-qwik/.wrangler/`.
Non inserire segreti nel codice o nelle variabili Vite. Eventuali futuri valori
privati locali restano in `tavolyn-qwik/.dev.vars`, ignorato da Git.
Nessun database remoto o UUID cloud è configurato; un futuro setup pubblico
richiederà risorse e identificativi reali approvati dal proprietario.

Nessun deploy pubblico, provisioning, DNS, invio email o modifica di billing
fa parte dei comandi ordinari o di questo task.
