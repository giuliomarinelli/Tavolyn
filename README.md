# Tavolyn

Demo portfolio in costruzione: Qwik 1.20 e Qwik City su **un solo Cloudflare
Worker**, con pagine e API nello stesso runtime. Il solo workspace applicativo
è `tavolyn-qwik/`. TAV-MVP-01 prepara il runtime: catalogo, ordini, autenticazione
e database appartengono ai task successivi.

## Requisiti e installazione

- Node.js **22.16.0**, npm **10.9.2**, come dichiarato nei `package.json`.
- Eseguire i comandi dalla radice del repository.
- Per il runtime locale non servono account Cloudflare/AWS, login, credenziali,
  database remoto o servizi a pagamento.

```sh
node --version
npm --version
npm ci
npm run check
npm run preview
```

Su Windows, se PowerShell intercetta `npm.ps1`, usare `npm.cmd` al posto di
`npm`. `npm ci` usa il lockfile condiviso e ricrea le dipendenze dei workspace.

Aprire <http://127.0.0.1:8787/>: appare la pagina Qwik Tavolyn.
Aprire <http://127.0.0.1:8787/api/health>: risposta HTTP 200,
`Content-Type: application/json`, `Cache-Control: no-store`:

```json
{ "status": "ok", "service": "tavolyn" }
```

Controllo HTTP da un secondo terminale, senza strumenti AI:

```sh
curl -i http://127.0.0.1:8787/
curl -i http://127.0.0.1:8787/api/health
```

In Windows PowerShell usare `curl.exe`. Arrestare il terminale di preview con
Ctrl+C. Non eseguire una nuova build mentre si stanno raccogliendo misure:
la ricostruzione svuota temporaneamente `dist/` e provoca reload di Wrangler.

## Comandi

| Comando dalla radice | Scopo                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `npm ci`             | Installazione riproducibile dal lockfile                                  |
| `npm run typecheck`  | TypeScript strict, incluso adapter e test                                 |
| `npm run lint`       | ESLint per sorgenti, configurazioni, test e script                        |
| `npm run build`      | Client Qwik, server Workers e bundle Wrangler in dry run                  |
| `npm test`           | Test di integrazione sul Worker compilato; richiede prima `npm run build` |
| `npm run check`      | Typecheck, lint, build, test; gate locale/CI senza deploy                 |
| `npm run dev`        | Build iniziale e avvio Wrangler locale                                    |
| `npm run preview`    | Avvio dell'ultima build con `wrangler dev --local`, porta 8787            |
| `npm run dev:vite`   | Authoring con HMR su Vite, porta 5173; non valida workerd                 |
| `npm run cf-typegen` | Rigenera i tipi dei binding da `wrangler.jsonc`                           |
| `npm run benchmark`  | Misura locale di pagina SSR e health; preview già avviato                 |

Per verificare una modifica: fermare preview, eseguire `npm run check`, riavviare
`npm run preview`. Il dry run di build **non pubblica nulla**. Gli output `dist/`,
`server/` e `.wrangler/` sono generati e ignorati da Git.

## Struttura e integrazioni successive

```text
tavolyn-qwik/
  src/routes/index.tsx                    pagina pubblica Qwik City
  src/routes/api/health/index.ts          endpoint GET nativo Qwik City
  src/lib/server/health/health-service.ts servizio server
  src/lib/shared/health.ts                contratto JSON condivisibile
  src/entry.cloudflare-pages.tsx          entry ufficiale Workers Qwik 1.20
  adapters/cloudflare-workers/            configurazione build ufficiale
  wrangler.jsonc                         unico Worker e asset locali
  worker-configuration.d.ts               binding generati da Wrangler
  tests/worker.test.ts                    integrazione su workerd
  scripts/benchmark-worker.mjs            profiling locale riproducibile
```

Le future pagine gestionali andranno in `src/routes/app/`, con gli stessi
layout/loader/handler di Qwik City e autorizzazione server. I futuri endpoint
andranno in `src/routes/api/`; i servizi di dominio in `src/lib/server/` e i soli
contratti sicuri per il browser in `src/lib/shared/`. Importare i servizi server
solo da handler/loader/funzioni server, mai dai componenti client.

D1 verrà collegato come binding `DB` in TAV-MVP-02; dopo la modifica di Wrangler
si rigenereranno i tipi. I binding tipizzati saranno disponibili in
`RequestEvent.platform.env`; la proxy locale di Vite è già predisposta.
Non esistono ancora database, migration, seed, risoluzione tenant o autenticazione.
Cognito verrà integrato tramite servizi server e Web APIs nel task dedicato.

Non inserire segreti nel codice o nelle variabili esposte a Vite. Per integrazioni
future, i valori privati locali andranno in `tavolyn-qwik/.dev.vars` (ignorato da
Git); i valori reali e gli identificativi dovranno provenire dalle risorse
esplicitamente approvate dal proprietario. Per questo bootstrap il file non serve.

## Riferimenti e verifica

- [Specifiche MVP autorevoli](docs/mvp/README.md)
- [Decisioni, risultati, limiti CPU e resoconto TAV-MVP-01](docs/mvp/TAV-MVP-01.md)
- [Adapter ufficiale Qwik Workers](https://qwik.dev/docs/deployments/cloudflare-workers/)
- [Test harness ufficiale Wrangler](https://developers.cloudflare.com/workers/testing/test-harness/get-started/)

Nessun comando di deploy pubblico è incluso nel flusso ordinario. Provisioning,
DNS, Cognito, email live e modifiche di billing richiedono autorizzazione umana.
