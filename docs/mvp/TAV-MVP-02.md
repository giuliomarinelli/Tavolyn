# TAV-MVP-02 — D1, risoluzione tenant e branding

## Perimetro

Implementazione locale sul bootstrap `016fabd`: una sola applicazione Qwik City
1.20 e un solo Worker. Due ristoranti interamente fittizi, Trattoria Aurora e
Nodo Pizza Lab, condividono database e struttura della pagina, con configurazioni
distinte lette da D1. Nessun catalogo, menu, carrello, checkout, Cognito o pagamento.
Nessuna risorsa cloud, operazione di billing, email live o pubblicazione remota.

## Modello dati

Migrazione versionata: `tavolyn-qwik/migrations/0001_tenants.sql`.

| Tabella          | Campi e vincoli                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `tenants`        | `id` TEXT PK, `slug` univoco, `name`, `branding_json`, `currency`, `timezone`, `contact_json`, `enabled`, `is_demo` |
| `tenant_domains` | `hostname` TEXT PK, `tenant_id` FK verso `tenants.id`, `primary_flag`, `local_only`                                 |

Gli ID del seed sono UUID testuali deterministici, non identificativi di risorse
Cloudflare. Sono presenti controlli JSON valido, valori booleani 0/1, dimensione
nome/slug e valuta a tre caratteri. Gli hostname devono essere minuscoli, senza
porta, percorso o punto finale; il resolver applica ulteriori controlli sintattici.
La FK impedisce domini orfani e cancella nessun tenant in cascata. L'indice su
`tenant_id` supporta le relazioni; un indice univoco parziale permette al massimo
un dominio primario per tenant. Le ricerche usano hostname e PK indicizzati.

`branding_json` contiene tema, palette, percorso del logo e testi della homepage.
`contact_json` contiene indirizzo, email, telefono, orari e nota del ristorante.
Il decoder server controlla tipi, lunghezze, colori esadecimali e percorsi SVG
locali prima di produrre il DTO pubblico `RestaurantSite`. Dati invalidi producono
un errore sicuro, non HTML o CSS arbitrario.

`is_demo` distingue i fixture dai dati non marcati; `local_only` distingue gli
alias di sviluppo dai domini autorizzati nella configurazione pubblica.
Non esiste un database/schema per tenant. Le future tabelle tenant-owned
dovranno mantenere i vincoli e filtri `tenant_id` del contratto MVP.

## Configurazione D1 locale

In `wrangler.jsonc` è configurato il binding **`DB`**, con nome locale
**`tavolyn-local`**, directory migrazioni `migrations` e `remote: false`.
**Non sono presenti `database_id` o `preview_database_id` fittizi** e non è stato
creato alcun database remoto. Wrangler 4.162.0 consente questo uso locale senza ID.

Il server accede solo a `RequestEvent.platform.env.DB`, con statement preparati
e parametri bindati. Non legge file SQLite. Wrangler conserva lo stato simulato
in `tavolyn-qwik/.wrangler/state/v3/d1/`, ignorato da Git. I tipi del binding sono
generati con `npm run cf-typegen`; `--strict-vars false` permette di tipizzare
anche l'override locale di `LOCAL_DEMO_MODE` senza modificare manualmente `Env`.

Per un futuro deploy autorizzato serviranno database e hostname reali, con ID
forniti dalle risorse effettivamente approvate. Questo runbook riguarda solo il
locale e non richiede account, token, username o credenziali.

## Risoluzione server-side

Il middleware Qwik City `src/routes/plugin@tenant.ts` esegue questi passi:

1. Legge l'URL della `Request` originale fornita dal runtime.
2. Normalizza hostname in minuscolo e rimuove un singolo punto DNS finale;
   la porta non partecipa all'identità. Rifiuta hostname sintatticamente invalidi.
3. Verifica la modalità locale e cerca il nome **esatto** in `tenant_domains`,
   con join a un tenant `enabled = 1`.
4. Filtra i record `local_only` quando la modalità locale non è valida.
5. Decodifica la configurazione e la conserva nella `sharedMap` della singola
   richiesta. Nessuna identità globale o cache tenant condivisa in memoria.

Query string, cookie, JSON body, `X-Tenant-Id`, `Forwarded` e `X-Forwarded-Host`
non partecipano alla ricerca. L'entry Workers elimina anche gli header di proxy
`Forwarded`, `X-Forwarded-Host` e `X-Forwarded-Proto` prima di invocare Qwik:
Qwik 1.20 altrimenti può usarli per ricostruire l'origine dei metadati SSR.
L'URL fornito dal Worker rimane l'autorità per resolver e pagina.

Homepage e API leggono lo stesso contesto risolto. `GET /api/public/site`
espone nome, slug, valuta, timezone, branding e contatti, senza ID database,
mappature dei domini o dati di altri tenant. Le risposte applicative hanno
`Cache-Control: no-store`; non è ancora introdotta una cache dei dati.

Hostname sconosciuto o tenant disabilitato: **404**. Configurazione D1 assente,
non inizializzata o non valida: **503**, senza SQL o contenuti grezzi negli errori.
Il solo endpoint site è di lettura: POST restituisce **405** con `Allow: GET, HEAD`.
Gli errori API hanno struttura `error: { code, message, requestId }`.

Eccezioni esplicite: `/api/health` verifica la liveness del Worker senza interrogare
D1 e resta disponibile anche su host non riconosciuto; gli asset statici condivisi
non contengono dati privati e non richiedono una risoluzione tenant.

## Hostname dimostrativi e modalità locale

| Hostname nel seed        | Tenant | Uso                                                   |
| ------------------------ | ------ | ----------------------------------------------------- |
| `aurora.tavolyn.test`    | Aurora | Fixture riservato per test del comportamento pubblico |
| `nodo.tavolyn.test`      | Nodo   | Fixture riservato per test del comportamento pubblico |
| `aurora.localhost`       | Aurora | Alias locale esplicito                                |
| `nodo.localhost`         | Nodo   | Alias locale esplicito                                |
| `localhost`, `127.0.0.1` | Aurora | Alias locali di ingresso                              |

`.test` e `.localhost` non rappresentano domini pubblici acquistati o configurati.
La base Wrangler imposta `LOCAL_DEMO_MODE=false`. `preview`/`dev` aggiungono
esplicitamente `--var LOCAL_DEMO_MODE:true` al solo processo locale; Vite HMR
abilita lo stesso flag nella sua proxy di sviluppo, fuori dal bundle Worker.

Il flag non è sufficiente da solo: serve anche un URL **HTTP** verso `localhost`,
`127.0.0.1` o un nome `.localhost` presente in D1. HTTPS locale, nomi sconosciuti,
suffissi ostili e query di selezione non costituiscono un bypass. La configurazione
pubblica rifiuta gli alias locali anche se esistono nel database. Solo le pagine
di preview mostrano i due collegamenti di cambio ristorante, con destinazioni fisse.

## Migrazioni e seed riproducibili

Dalla radice, Node 22.16.0 / npm 10.9.2; in PowerShell usare `npm.cmd` se necessario:

```sh
npm ci
npm exec --workspace tavolyn-qwik -- playwright install chromium
npm run cf-typegen
npm run db:migrate
npm run db:seed
npm run check
npm run preview
```

`npm run db:setup` equivale agli ultimi due comandi D1 in sequenza.
Tutti gli script D1 includono **`--local`**. Wrangler registra le migrazioni in
`d1_migrations`: una seconda esecuzione non le riapplica. Il seed SQL esegue
`INSERT ... ON CONFLICT DO NOTHING`: niente duplicati, DELETE, reset o sovrascrittura
di modifiche manuali. Le mappature vengono inserite solo per righe marcate demo.
Su un database vuoto il risultato è sempre due tenant e sei domini.
Il seed non ripristina campi modificati: è un'inizializzazione ripetibile, non un reset.

Per interrogare il risultato, entrare in `tavolyn-qwik/` ed eseguire:

```sh
npm exec -- wrangler d1 execute DB --local --command "SELECT (SELECT COUNT(*) FROM tenants) AS tenants, (SELECT COUNT(*) FROM tenant_domains) AS domains, (SELECT COUNT(*) FROM d1_migrations) AS migrations;"
```

Risultato verificato dopo più setup: **2 tenant, 6 domini, 1 migrazione**.
Aprire poi `http://aurora.localhost:8787/` e `http://nodo.localhost:8787/`.
Per HMR eseguire separatamente `npm run dev:vite`, dopo il setup D1, e usare
gli stessi hostname sulla porta 5173. Non sono necessarie modifiche DNS pubbliche.

## Verifica automatica e visuale

`npm run check` esegue typecheck, lint, build Qwik/Workers in dry run, Vitest
e Playwright in sequenza. Vitest ha `fileParallelism: false`; Playwright usa
un solo worker e nessun retry. Non sono stati impiegati subagenti.

- **34 test di integrazione** sul Worker compilato e D1 reale isolata dal database
  di sviluppo: ripetizione schema/seed, unicità, FK, JSON valido, due configurazioni,
  due HTML separati, hostname ostili/sconosciuti, normalizzazione, query/header/cookie,
  body POST, lettura di modifiche D1 effettive, tenant disabilitato, errori sicuri,
  blocco degli alias nel comportamento pubblico e modalità locale circoscritta.
- La verifica HTTPS locale usa dispatch diretto a workerd: la proxy HTTP del
  test harness normalizza il protocollo e non può rappresentare quel caso da sola.
  Nessuna asserzione è stata saltata per risolvere questa differenza.
- **6 test Chromium**: Aurora/Nodo a 1440, 390 e 320 px. Verificano identità e logo
  caricato, footer, assenza di overflow della pagina e del titolo, ancore contatti,
  cambio hostname tramite navigazione e assenza di errori JavaScript.
- I test browser avviano il preview Workers e riapplicano il setup locale
  non distruttivo. Richiedono la porta 8787 libera e arrestano il proprio server.
- Screenshot completi in `.wrangler/browser-results/`, esclusi da Git, rivisti
  visivamente per entrambe le identità su desktop e mobile.

Aurora usa carta/terracotta, titoli serif e un simbolo originale ispirato ad alba
e forno; Nodo usa verde scuro/lime, titoli sans-serif e un simbolo orbitale.
Logo, palette, testi, contatti e favicon derivano dal tenant risolto. Le illustrazioni
SVG sono originali del repository; non ci sono font/CDN o immagini esterne.
Le azioni sono ancore reali o navigazione locale. Contatti e orari sono esplicitamente
inventati, senza pulsanti di prenotazione, menu o invio messaggi.

### Esito finale del 15 novembre 2026

| Controllo                                 | Esito                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm ci`                                  | Exit 0, 477 pacchetti installati, 479 verificati                                   |
| `npm run cf-typegen`                      | Exit 0, rigenerazione identica dei tipi finali                                     |
| `npm run check` dopo installazione pulita | Exit 0: typecheck, lint, build, 34 test D1/Workers e 6 test browser                |
| Bundle Workers dry run                    | 203.22 KiB, gzip 60.02 KiB, nessun upload                                          |
| Setup ripetuto e query D1 locale          | Nessuna migrazione aggiuntiva da applicare, 2 tenant / 6 domini / 1 migrazione     |
| Vite HMR                                  | Entrambi gli hostname restituiscono il rispettivo sito tramite la stessa D1 locale |
| `npm audit`                               | 10 segnalazioni note: 8 moderate, 2 high, zero critical                            |
| `npm audit --omit=dev`                    | Exit 0, zero segnalazioni nel sottoinsieme npm senza dipendenze dev                |

Controllati inoltre i 65 file candidati al commit: nessun artefatto di build,
database locale, trace o screenshot incluso, e nessuna corrispondenza ai pattern
di chiavi private, token e credenziali cercati. I bundle client non contengono
la query SQL o il nome `tenant_domains`. Si tratta di controlli mirati e revisione
dei file, non di una certificazione generale di assenza di qualsiasi segreto.

Il log completo del gate finale rimane localmente in
`tavolyn-qwik/.wrangler/TAV-MVP-02-check.log`. L'audit senza dipendenze dev non
certifica la sicurezza del bundle: Qwik è dichiarato come dipendenza di sviluppo
ma viene in parte incluso nel Worker. Le segnalazioni e i limiti descritti nel
resoconto TAV-MVP-01 rimangono da rivalutare quando si aggiungono handler e validator.
Tutti i server avviati per la verifica sono stati arrestati.

## File principali

| File                                                             | Intervento                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `wrangler.jsonc`, `worker-configuration.d.ts`                    | Binding DB, flag pubblico disabilitato, tipi generati                           |
| `migrations/0001_tenants.sql`, `seeds/demo-tenants.sql`          | Schema e fixture deterministici                                                 |
| `src/lib/server/tenants/tenant-service.ts`                       | Query D1, decodifica sicura, contesto per richiesta                             |
| `src/lib/shared/site.ts`                                         | DTO pubblico tipizzato                                                          |
| `src/routes/plugin@tenant.ts`                                    | Risoluzione comune e risposte 404/503 sicure                                    |
| `src/routes/api/public/site/index.ts`                            | Lettura del sito, rifiuto POST                                                  |
| `src/entry.cloudflare-pages.tsx`                                 | Protezione dell'origine SSR dagli header proxy arbitrari                        |
| `src/routes/index.tsx`, `src/global.css`                         | Homepage unica e temi responsive                                                |
| `src/root.tsx`, `src/components/router-head/router-head.tsx`     | Rimossi manifest/favicon generici dalla pagina, favicon tenant nel DocumentHead |
| `public/brands/aurora.svg`, `public/brands/nodo.svg`             | Simboli originali dei due ristoranti                                            |
| `vite.config.ts`                                                 | Modalità locale della proxy D1 per authoring                                    |
| `vitest.config.ts`, `tests/worker.test.ts`                       | Test D1/Workers seriali                                                         |
| `playwright.config.ts`, `tests/browser/homepages.spec.ts`        | Test responsive riproducibili                                                   |
| `package.json` nella radice e nel workspace, `package-lock.json` | Comandi D1/browser, dipendenza dev Playwright fissata                           |
| README e documenti MVP collegati                                 | Setup aggiornato e resoconto del task                                           |

## Limiti e attività esterne

I risultati sono locali: nessuna verifica su un endpoint pubblico, Safari o device
fisico. Il budget CPU Workers Free resta da verificare su un futuro deploy
autorizzato; i tempi locali non sono CPU cloud certificata. Non è stata modificata
l'architettura per aggirare quote e non sono stati attivati servizi a pagamento.

Le advisory note della toolchain Qwik/ESLint del task precedente richiedono ancora
una soluzione compatibile. Nessun aggiornamento forzato è stato applicato.
Playwright è una dipendenza di sviluppo e Chromium è installato solo come strumento
di test locale, senza introdurre un runtime applicativo aggiuntivo.

Non sono implementate autenticazione o autorizzazioni staff: il servizio espone
soltanto branding pubblico, non dati operativi. L'isolamento delle future entità
tenant-owned dovrà essere verificato nei rispettivi task. Nessun setup esterno
richiesto per questa consegna. Nessun push senza nuova autorizzazione.

## Riferimenti

- [D1: sviluppo locale](https://developers.cloudflare.com/d1/best-practices/local-development/)
- [D1: migrazioni](https://developers.cloudflare.com/d1/reference/migrations/)
- Schema e API Wrangler della versione installata sotto `node_modules/wrangler/`
- [Qwik: request handling](https://qwik.dev/docs/advanced/request-handling/)
- [Playwright: server di test](https://playwright.dev/docs/test-webserver)
