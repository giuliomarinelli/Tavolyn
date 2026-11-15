# TAV-MVP-01 — Qwik City su Cloudflare Workers

## Stato iniziale verificato

Il 15 novembre 2026 il worktree era pulito. `tavolyn-node/` era uno starter
NestJS 12: un modulo, un controller GET `/`, un servizio `Hello World!` e i
relativi test. Non conteneva logica Tavolyn, persistenza o integrazioni da migrare.
La directory viene rimossa integralmente insieme al workspace, alle dipendenze
e agli override specifici. Il workspace Qwik 1.20 viene preservato.

## Configurazione e decisioni

- Un solo workspace, `tavolyn-qwik`, e un solo Worker `tavolyn`. Nessun backend
  separato. Il nome nel file Wrangler identifica l'applicazione; non implica che
  esista già una risorsa cloud.
- Qwik e Qwik City sono fissati a **1.20.0**. L'adapter è già distribuito in
  `@builder.io/qwik-city`; non esiste un pacchetto Workers separato da installare.
  La configurazione riprende il template `cloudflare-workers` della versione
  installata, che importa `cloudflarePagesAdapter` e il middleware
  `cloudflare-pages`. Anche il nome `entry.cloudflare-pages.tsx` è richiesto dal
  generatore dell'adapter: l'output è comunque un Worker ES module.
- Wrangler **4.162.0**, tipi Workers **5.20261115.1**, compatibility date
  **2026-11-15**, flag `nodejs_compat`. Tipi `Env` generati dal file di
  configurazione, non ricopiati manualmente; nessun binding DB o segreto fittizio.
- Vite **7.3.8**, compatibile con Qwik 1.20 (`>=5 <8`), e Vitest **4.1.12**.
  L'override Vite mantiene una sola versione compatibile anche per Vitest:
  senza vincolo npm 10.9.2 può risolvere il suo intervallo verso Vite 8 e fallire
  nella risoluzione dei peer opzionali con `edgesOut`. Non sono stati usati
  `--force` o `--legacy-peer-deps`.
- Eliminati gli override Nest/Angular e dei plugin Vitest non utilizzati;
  conservati gli override preesistenti di `picomatch` e `vite-imagetools`.
  Il lockfile è stato rigenerato: nessuna voce workspace o dipendenza Nest residua.
- Binding asset **`ASSETS`**, come richiesto dal middleware effettivo. Il template
  Wrangler 1.20 usa invece `ASSET`: è stato corretto per allinearlo al codice.
  Gli asset sono in `dist/`; `_worker.js`, metadati Pages e source map sono esclusi
  dalla pubblicazione come file statici tramite `public/.assetsignore`.
- `/api/*`, `/app` e `/app/*` passano prima dal Worker, così future API e pagine
  gestionali potranno imporre controlli server. Le pagine gestionali non sono
  implementate in questo task. I normali bundle e asset pubblici possono essere
  serviti direttamente dallo stesso deployment Workers.
- Rendering SSR per la sola pagina di bootstrap. `ssg.include: []` mantiene
  dinamiche le route: in 1.20 `ssg: null` salta anche la generazione di
  `dist/_worker.js` e dei manifest necessari. Nessun fallback o framework parallelo.
- `npm run build` esegue `qwik build` e `wrangler deploy --dry-run`: valida e
  prepara il bundle senza effettuare upload. Nessuno script di deploy pubblico.
- Vite HMR è solo uno strumento opzionale di authoring, con `getPlatformProxy`
  per i futuri binding locali; la verifica del runtime usa Wrangler/workerd.
  L'entry di preview Node è stata eliminata.
- `/api/health` è una verifica di liveness, non una verifica di D1/Cognito.
  Restituisce `{ "status": "ok", "service": "tavolyn" }` senza cache.

## Procedura riproducibile

Vedere il [README principale](../../README.md) per requisiti, avvio e comandi
HTTP. Dalla radice, con Node 22.16.0 e npm 10.9.2:

```sh
npm ci
npm run cf-typegen
npm run check
npm run preview
```

Su Windows usare `npm.cmd` se necessario. Per controlli manuali aprire `/` e
`/api/health` su `http://127.0.0.1:8787`. Per la suite test serve la build;
`npm run check` rispetta automaticamente questo ordine. I test usano
`createTestHarness` di Wrangler sul medesimo `wrangler.jsonc` e sull'output
dell'adapter: niente handler HTTP simulati e niente richieste a servizi cloud.

Per il benchmark, lasciare attivo solo il preview, senza browser che stiano
caricando l'applicazione, e da un secondo terminale eseguire:

```sh
npm run benchmark
```

Lo script invia 10 richieste di riscaldamento e 100 richieste sequenziali per
route, consumando la risposta completa. Usa il profiler V8 del Worker tramite
l'inspector locale sulla porta 9229 e salva i profili sotto
`tavolyn-qwik/.wrangler/benchmarks/`. Il pacchetto `ws` è uno strumento di sviluppo
per questo inspector; non implementa WebSocket nell'applicazione e non entra
nel bundle Worker. Porta HTTP e inspector devono essere libere prima di avviare
preview; non collegare contemporaneamente un altro debugger.

Per analizzare l'avvio, entrare nel workspace Qwik ed eseguire:

```sh
npm exec -- wrangler check startup
```

Il comando produce un profilo locale `worker-startup.cpuprofile`, escluso da Git
tramite `*.cpuprofile`. Può essere spostato in `.wrangler/benchmarks/` per raccogliere
i risultati nella stessa directory. L'avvio non misura il costo CPU delle
richieste HTTP.

## Evidenza locale del 15 novembre 2026

| Verifica               | Risultato                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm ci`               | Installazione pulita riuscita, 474 pacchetti installati                                                               |
| TypeScript strict      | Superato, inclusi entry Worker, configurazioni e test                                                                 |
| ESLint                 | Superato; configurazioni/test non più esclusi dal lint                                                                |
| Build Qwik + adapter   | Client e server generati nello stesso progetto                                                                        |
| Vitest sul Worker      | 7 test passati, nessuna asserzione saltata                                                                            |
| Wrangler locale        | Pagina `/` e `/api/health` HTTP 200 sulla stessa origine                                                              |
| Browser Playwright     | Titolo e contenuti italiani, 1600 px e 390 × 844 px senza overflow orizzontale; nessun errore console dell'app        |
| Asset e confini server | Bundle JS e favicon HTTP 200; route sconosciute, `_worker.js` e `_routes.json` HTTP 404                               |
| Ricerca dipendenze     | Nessun `@nestjs`, `tavolyn-node`, `reflect-metadata` o `supertest` nei manifest/lockfile applicativi                  |
| Startup locale         | Bundle 187.19 KiB, gzip 55.02 KiB; finestra 36.2 ms, solo 2 campioni: insufficiente per dedurre il costo CPU di avvio |

Prima misura locale delle route, senza carico concorrente intenzionale:

| Route             | Richieste misurate | Latenza mediana | Latenza p95 | Attività V8 non-idle campionata media/richiesta |
| ----------------- | ------------------ | --------------- | ----------- | ----------------------------------------------- |
| `/` SSR bootstrap | 100                | 6.86 ms         | 8.03 ms     | 6.79 ms (203 campioni totali)                   |
| `/api/health`     | 100                | 5.29 ms         | 6.68 ms     | 4.47 ms (77 campioni totali)                    |

La prima richiesta osservata, prima del riscaldamento dello script, ha impiegato
43.46 ms per `/` e 5.61 ms per health: sono tempi di parete e non costi CPU.
Il campionamento somma gli intervalli non marcati `(idle)` e include overhead
del runtime e del profiler: **non equivale alla CPU fatturata da Cloudflare**.
La grana dei campioni su Windows e l'hardware locale limitano la precisione.

### Fattibilità Workers Free e limiti aperti

La documentazione Cloudflare consultata il 15 novembre 2026 indica **10 ms CPU
per richiesta HTTP** su Workers Free. Il bootstrap minimale funziona localmente;
questo esperimento non certifica il rispetto del budget in cloud e non misura
menu, checkout, D1 o autenticazione, ancora assenti. Non si assume quindi che
pagine SSR più complesse siano già sostenibili.

Ripetere il benchmark sulle route rappresentative quando verranno implementate
e verificare le metriche CPU effettive solo dopo un futuro deploy autorizzato.
Se il budget Free viene superato, usare prerender/asset pubblici compatibili con
tenant e dati nello stesso Worker, esplicitando il compromesso di aggiornamento
e SEO; evitare prerender delle pagine private e non cambiare piano a pagamento.

## Problemi residui e setup esterno

- `npm audit` segnala **10 segnalazioni su pacchetti: 8 moderate e 2 high**, zero critical,
  riconducibili a due advisory con propagazione alle dipendenze superiori. Sono
  segnalazioni propagate da `minimatch` nella toolchain ESLint e da Zod 3.25.48
  fissato da Qwik City 1.20. Non sono stati applicati downgrade di Qwik o override
  verso Zod 4 incompatibili con il contratto della versione installata.
  Richiedono una verifica/soluzione compatibile prima della pubblicazione.
- npm segnala anche la deprecazione di ESLint 9.32.0 e `tsconfck` 3.1.6 della
  toolchain preservata. I gate funzionali e di compilazione passano comunque.
- Non sono stati implementati tenant, database, catalogo, checkout, sessioni,
  Cognito, pagamenti o email. Nessuna simulazione viene presentata come
  persistenza o autenticazione reale.
- Nessun setup esterno richiesto per TAV-MVP-01. Nessuna risorsa Cloudflare/AWS
  creata, nessun deploy pubblico, invio email o modifica di billing.

## Verifica conclusiva prima del task successivo — 15 novembre 2026

Verifica eseguita in sequenza, senza subagenti, partendo dal commit `07ebd21`.
Dopo `git fetch origin develop`, branch locale e remoto coincidevano: worktree
pulito, `git diff --check` senza errori e diff rispetto a `develop`/`origin/develop`
vuoto. Per esaminare l'intera migrazione già pubblicata è stato quindi usato
`git diff 366a4ae..07ebd21`: 47 file modificati, compresa la rimozione completa
dello starter. Nessuna implementazione di TAV-MVP-02 è stata avviata.

### Riproducibilità verificata

- `npm ci`: riuscito, 474 pacchetti installati; nessuna modifica al lockfile.
- `npm run cf-typegen`: riuscito, nessuna variazione dei tipi versionati.
- `npm run check`: riuscito; typecheck, lint, build client/server, bundle Wrangler
  in dry run e **7 test di integrazione passati**, nessun test saltato.
- `npm run dev`: build iniziale e successivo `preview` Wrangler avviati;
  `/` restituisce HTML Qwik e `/api/health` JSON HTTP 200 con `no-store`.
- `npm run benchmark`: riuscito; profili salvati nella directory ignorata
  `.wrangler/benchmarks/`.
- `npm exec -- wrangler check startup`, dal workspace Qwik: riuscito; il profilo
  `worker-startup.cpuprofile` risulta ora ignorato automaticamente da Git.
- `npm run dev:vite`: avviato separatamente dopo aver fermato Wrangler;
  pagina e health HTTP 200. È una verifica dello strumento HMR, distinta da workerd.
- I processi locali avviati per questa verifica sono stati arrestati.

La nuova misura locale su 100 richieste per route ha dato mediana/p95 HTTP
11.54/14.27 ms per `/` e 8.12/11.48 ms per health; attività non-idle campionata
11.15 e 6.87 ms/richiesta rispettivamente. La variabilità rispetto alla prima
misura conferma il limite dell'esperimento: **non prova il rispetto del budget
CPU Free**, né dimostra uno sforamento della CPU effettiva cloud. Resta aperta
la verifica cloud dopo un futuro deploy autorizzato; non è stata modificata
l'architettura o attivato un piano a pagamento.

### Advisory: grafo npm e codice effettivamente eseguito

| Verifica | Risultato e significato |
| --- | --- |
| `npm audit` | Exit 1: 10 segnalazioni su pacchetti, 8 moderate e 2 high; due advisory sottostanti |
| `npm audit --omit=dev` | Exit 0: 0 vulnerabilità nel sottoinsieme npm che esclude le dipendenze di sviluppo |
| `npm explain zod` | Zod 3.25.48 è richiesto da Qwik City 1.20, dichiarato in `devDependencies` |
| Bundle Worker e source map | Nessun riferimento a Zod/minimatch nei JS emessi da Vite/Wrangler; nessuna sorgente di queste librerie o della toolchain lint/test nella source map Wrangler |

La classificazione npm non basta a stabilire l'esposizione: Qwik è dichiarato
come dipendenza di sviluppo ma parte del suo codice viene incluso nel Worker.
Per il bootstrap corrente, l'analisi del bundle e le sole route implementate
non mostrano un percorso runtime verso i due moduli segnalati. Questo risultato
vale per la build verificata, non è una garanzia per gli endpoint futuri.

- [minimatch / GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249):
  rischio di consumo eccessivo di risorse durante l'elaborazione di pattern;
  qui raggiunto dalla toolchain ESLint/TypeScript, non dagli handler pubblici.
- [Zod / GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5):
  rischio di esaurimento memoria nella validazione di collezioni molto grandi.
  Zod è transitivo di Qwik City, ma non risulta nel bundle del bootstrap attuale.
  Rivalutare l'esposizione quando si introducono validator, action e input pubblici.

Non sono stati eseguiti `npm audit fix`, aggiornamenti forzati, downgrade o
override aggiuntivi. Le segnalazioni della toolchain e la necessità di una
soluzione compatibile restano documentate; lo zero con `--omit=dev` non va
presentato come certificazione generale di sicurezza del Worker.

### File pubblicabili e controllo dei segreti

Controllati i 54 file tracciati, le modifiche della migrazione e le regole ignore:
nessun output `dist/`, `server/` alla radice del workspace, `node_modules/`,
`.wrangler/`, log, file temporaneo, profilo o configurazione privata è tracciato.
`src/lib/server/` contiene invece i sorgenti applicativi previsti e resta versionato.
`worker-configuration.d.ts` è la dichiarazione generata dei binding e resta
intenzionalmente versionata, senza valori privati.

Una scansione dei file tracciati per chiavi private, token GitHub/AWS, JWT,
assegnazioni di credenziali e URL con credenziali non ha rilevato corrispondenze.
Non sono stati letti file privati ignorati né stampati valori potenzialmente
sensibili. Il controllo è basato su pattern e revisione dei file, non su una
certificazione di assenza di qualsiasi possibile segreto.

Verificate con `git check-ignore -v` le esclusioni di `.env`, `.env.*`,
`.dev.vars`, `.dev.vars.*`, `dist/`, `server/`, `.wrangler/` e `*.cpuprofile`.
La sola correzione aggiuntiva riguarda `*.cpuprofile`: protegge anche il profilo
di startup generato dal comando documentato, senza richiedere uno spostamento
manuale per evitarne il commit. Nessuna dipendenza o logica applicativa modificata.

## Resoconto dei file

| File / directory                                                                  | Modifica                                                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `tavolyn-node/`                                                                   | Eliminati tutti i 17 file dello starter e la directory                 |
| `package.json`                                                                    | Un workspace, comandi comuni e rimozione override inutilizzati         |
| `package-lock.json`                                                               | Rigenerato per il solo workspace Qwik e la toolchain Workers           |
| `tavolyn-qwik/package.json`                                                       | Nome applicativo, versioni, script runtime/build/test/profiling        |
| `tavolyn-qwik/vite.config.ts`                                                     | Configurazione Qwik City semplificata e proxy binding locale opzionale |
| `tavolyn-qwik/adapters/cloudflare-workers/vite.config.ts`                         | Adapter ufficiale, output SSR e generazione entry                      |
| `tavolyn-qwik/src/entry.cloudflare-pages.tsx`                                     | Entry Worker e piattaforma con `Env` tipizzato                         |
| `tavolyn-qwik/src/entry.preview.tsx`                                              | Eliminato il preview Node                                              |
| `tavolyn-qwik/wrangler.jsonc`                                                     | Un Worker, asset, compatibility date, osservabilità locale/cloud       |
| `tavolyn-qwik/worker-configuration.d.ts`                                          | Binding `ASSETS` generato                                              |
| `tavolyn-qwik/public/.assetsignore`                                               | Esclusione degli artefatti server dagli asset                          |
| `tavolyn-qwik/tsconfig.json`, `eslint.config.js`                                  | Typecheck strict e lint estesi a configurazioni/test/script            |
| `tavolyn-qwik/.gitignore`                                                         | Output Wrangler e configurazioni private esclusi                       |
| `tavolyn-qwik/src/routes/api/health/index.ts`                                     | GET JSON nativo Qwik City senza cache                                  |
| `tavolyn-qwik/src/lib/server/health/health-service.ts`                            | Servizio di liveness server                                            |
| `tavolyn-qwik/src/lib/shared/health.ts`                                           | Contratto della risposta health                                        |
| `tavolyn-qwik/src/routes/index.tsx`, `src/global.css`                             | Pagina di bootstrap italiana responsive                                |
| `tavolyn-qwik/src/root.tsx`, `src/entry.ssr.tsx`, `public/manifest.json`          | Lingua italiana e metadati Tavolyn                                     |
| `tavolyn-qwik/vitest.config.ts`, `tests/worker.test.ts`                           | Suite di integrazione su Worker compilato                              |
| `tavolyn-qwik/scripts/benchmark-worker.mjs`                                       | Misure HTTP e profili V8 locali riproducibili                          |
| `README.md`, `tavolyn-qwik/README.md`                                             | Installazione, comandi e struttura applicativa                         |
| `docs/mvp/README.md`, `01-runtime-and-security.md`, `05-delivery-qa-and-costs.md` | Stato repository e collegamenti al runbook corrente                    |
| `docs/mvp/TAV-MVP-01.md`                                                          | Decisioni, prove, file e rischi residui di questo task                 |

## Fonti ufficiali

- [Qwik Workers adapter](https://qwik.dev/docs/deployments/cloudflare-workers/)
- Template installato: `node_modules/@builder.io/qwik/dist/starters/adapters/cloudflare-workers/`
- [Wrangler test harness](https://developers.cloudflare.com/workers/testing/test-harness/get-started/)
- [Workers static assets](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Workers limits e CPU](https://developers.cloudflare.com/workers/platform/limits/)
- [Profiling CPU locale](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/)
