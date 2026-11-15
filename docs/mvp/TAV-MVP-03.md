# TAV-MVP-03 — Catalogo, menu e carrello

## Perimetro e base

Implementazione sul commit `2903dacadbb0506ae7a4fbed0d1ac796345c7763`, inizialmente
pulito e allineato a `origin/develop` dopo fetch. Un solo agente, attività e
verifiche in sequenza. Nessun subagente, nuovo runtime o dipendenza aggiunta.
Risoluzione tenant, binding D1 e branding di TAV-MVP-02 riutilizzati.

Le homepage conducono a un vero menu D1; i piatti possono essere configurati e
conservati nel carrello del ristorante. Non sono implementati quote server-side,
checkout, ordini, autenticazione o pagamenti. TAV-MVP-04 non è stato avviato.

## Modello dati

Nuova migrazione **`tavolyn-qwik/migrations/0002_catalog.sql`**; `0001_tenants.sql`
resta invariata. Ogni tabella ha `tenant_id` e PK composita `(tenant_id, id)`.

| Tabella | Dati e vincoli |
| --- | --- |
| `categories` | Nome, ordine intero e flag `active`; FK tenant verso `tenants` |
| `products` | Categoria, slug univoco nel tenant, nome, descrizione, `image_url` nullable, prezzo base intero, disponibilità, ordine |
| `modifier_groups` | Prodotto, titolo, `min_select`, `max_select`, ordine |
| `modifiers` | Gruppo, etichetta, supplemento intero, disponibilità, ordine |

Le FK composite categoria→prodotto→gruppo→modificatore impediscono riferimenti
tra tenant differenti. Cancellazione dei parent con figli rifiutata (`RESTRICT`).
Gli indici iniziano con `tenant_id` e coprono associazioni/ordinamento.
Controlli SQL: prezzi e supplementi interi fra 0 e 1.000.000 centesimi, booleani
0/1, titoli non vuoti, `0 <= min_select <= max_select <= 20`, massimo positivo.
Non sono persistiti prezzi floating-point. La valuta deriva dal tenant.

`image_url` rimane nullo nei fixture: menu tipografico, palette e SVG originali
già presenti nel repository. Nessuna fotografia, font remoto o CDN aggiunto.

## Seed ripetibili

`seeds/demo-catalog.sql` contiene UUID testuali deterministici e insert con
`ON CONFLICT DO NOTHING`, limitati ai due ID demo esistenti con `is_demo = 1`.
Nessun DELETE, reset o aggiornamento delle righe presenti. La riesecuzione
preserva anche cambiamenti manuali a prezzi, testi, disponibilità e ordinamento.

- **Aurora:** 5 categorie, 15 prodotti; antipasti, pizze, primi, dolci e bevande.
- **Nodo:** 5 categorie, 12 prodotti; classici, esperimenti, contorni, dolce e bevande.
- Impasti obbligatori a scelta singola; extra facoltativi con massimo due scelte.
  Pasta al ragù con scelta obbligatoria del formato.
- Due prodotti esauriti ad Aurora e uno a Nodo; alcuni extra non disponibili.
- Totali fixture: 10 categorie, 27 prodotti, 19 gruppi e 56 modificatori.

Gli ID del seed sono dati applicativi fittizi, non identificativi Cloudflare.

## API e organizzazione

- `src/lib/shared/catalog.ts`: DTO pubblico e funzioni di presentazione dei prezzi
  e validazione delle selezioni. Nessuna query o identità server nel DTO.
- `src/lib/server/catalog/catalog-service.ts`: quattro statement preparati in un
  batch D1 di lettura. Ogni query filtra il tenant risolto server-side; tutti i
  join usano sia ID sia `tenant_id`. Solo categorie attive e relativi figli.
- `src/routes/api/public/menu/index.ts`: **GET `/api/public/menu`**. Nessun endpoint
  amministrativo o selettore prodotto/tenant fornito dal browser.
- `src/routes/(shop)/layout.tsx`: loader Qwik City che usa lo stesso servizio,
  shell grafica e contesto carrello condivisi da `/menu/` e `/cart/`.
- `src/components/catalog/product-card.tsx`: dettagli nativi, form di scelta,
  vincoli min/max, feedback di aggiunta e stato esaurito.

Risposta pubblica (campi illustrativi, non un terzo seed):

```json
{
  "currency": "EUR",
  "categories": [{
    "id": "category-uuid", "name": "Pizze",
    "products": [{
      "id": "product-uuid", "slug": "margherita", "name": "Margherita",
      "description": "Pomodoro, fiordilatte e basilico.",
      "basePriceCents": 800, "available": true,
      "modifierGroups": [{
        "id": "group-uuid", "title": "Il tuo impasto", "minSelect": 1, "maxSelect": 1,
        "modifiers": [{ "id": "modifier-uuid", "label": "Classico", "deltaPriceCents": 0, "available": true }]
      }]
    }]
  }]
}
```

Gli ID pubblici servono alle selezioni, non autorizzano accessi. Non sono esposti
tenant ID, hostname, flag demo, FK parent o altro catalogo. Gli articoli esauriti
restano visibili con `available: false`; non si possono aggiungere alla UI.
Ordine stabile per `sort_order, id` a ogni livello. Nessuna cache condivisa:
`Cache-Control: no-store` e middleware tenant esistente su API e pagine.

Host sconosciuto/tenant disabilitato: 404. Errore storage catalogo: 503 sicuro
`{ error: { code: "MENU_UNAVAILABLE", message, requestId } }`, senza SQL o dettagli
D1. Il sito e health rimangono indipendenti dalle tabelle catalogo.
L'endpoint dichiara solo GET: altri metodi rispondono 405 con `Allow: GET` quando
raggiungono il route handler. Restano attive le protezioni native Qwik City,
che possono rifiutare prima le POST non conformi con 403.

## Carrello

Stato reattivo Qwik in contesto: righe `{ productId, modifierIds, quantity }`.
La combinazione prodotto + ID modificatori ordinati identifica una riga: aggiunte
equivalenti incrementano la quantità; configurazioni diverse restano separate.
Quantità 1–99, al massimo 50 configurazioni; rimozione esplicita della riga.

Persistenza `localStorage` con chiave **`tavolyn:cart:v1:<slug>`**, oltre al naturale
isolamento per origine del browser. La chiave deriva dal sito risolto sul server.
Non vengono salvati nomi, prezzi o totali: la pagina usa il catalogo D1 corrente.
Il recupero scarta righe di altri tenant, prodotti rimossi/esauriti, opzioni non
valide o quantità scorrette e informa il visitatore. JSON corrotto o memoria
disabilitata non bloccano la pagina; senza storage si mantiene lo stato della
pagina corrente, senza promettere persistenza attraverso una navigazione.

Il caricamento dello storage avviene in `useVisibleTask$` a `document-ready`, mai
durante SSR. Stato iniziale coerente server/client e controlli disabilitati fino
al recupero. Il task di salvataggio attende `ready` e ha una guardia `isServer`.
Limite di lettura 100.000 caratteri, versionamento e controllo dei dati salvati.

Il totale è **solo indicativo**. La validazione UI non autorizza un ordine e non
protegge importi economici: il task successivo dovrà ricalcolare e verificare
tutto sul server. Il carrello spiega la fase futura senza azioni di checkout
inerti. Nessuna chiamata esterna, creazione ordine o simulazione di pagamento.

## Esecuzione locale riproducibile

Node 22.16.0, npm 10.9.2. Dalla radice del repository:

```sh
npm ci
npm exec --workspace tavolyn-qwik -- playwright install chromium
npm run db:setup
npm run check
npm run cf:dev
```

Su Windows usare `npm.cmd` se necessario. `db:setup` applica le migrazioni locali
incrementali e poi `demo-tenants.sql` e `demo-catalog.sql`, in ordine. Tutti i
comandi D1 usano `--local`, senza login o credenziali. Per un database esistente
la prima migrazione non viene riapplicata; la seconda aggiunge solo nuove tabelle.
Gli avvii browser rieseguono il setup non distruttivo. Non serve rifare `npm ci`
su una checkout già installata: questo task non cambia dipendenze o lockfile.

Aprire `http://aurora.localhost:8787/menu/` oppure
`http://nodo.localhost:8787/menu/`, personalizzare un piatto e raggiungere `/cart/`.
Provare refresh e cambio ristorante con i link della barra locale.

Verifica HTTP con Wrangler attivo:

```sh
curl --resolve aurora.localhost:8787:127.0.0.1 http://aurora.localhost:8787/api/public/menu
curl --resolve nodo.localhost:8787:127.0.0.1 http://nodo.localhost:8787/api/public/menu
```

Su PowerShell usare `curl.exe`. Per controllare D1, dal workspace `tavolyn-qwik/`:

```sh
npm exec -- wrangler d1 execute DB --local --command "SELECT (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM modifier_groups) AS groups_count, (SELECT COUNT(*) FROM modifiers) AS modifiers, (SELECT COUNT(*) FROM d1_migrations) AS migrations;"
```

Atteso sul demo iniziale: **10 / 27 / 19 / 56**, due migrazioni registrate.
Le modifiche manuali preservate possono naturalmente cambiare questi conteggi.
Nessun UUID remoto, configurazione privata o setup cloud richiesto.

## Verifiche e qualità

- **`npm run check`: exit 0**, sequenza completa finale con typecheck, lint,
  build Workers, 75 test Vitest e 15 test browser, senza test saltati.
- TypeScript strict, ESLint e build Qwik/Workers in dry run superati. Corrette le
  esclusioni generiche `lib`/`server` di ESLint e Prettier per includere i sorgenti
  applicativi, conservando l'esclusione degli output alla radice.
- **75 test Vitest**: suite precedente, migrazione incrementale, seed ripetibile
  con conservazione degli edit, FK composite ostili/orfane, tipi e limiti SQL,
  cataloghi separati, selettori tenant/prodotto ignorati, disponibilità, rendering
  SSR, categorie inattive/menu vuoto, errori sicuri e validazione carrello.
- **15 test Chromium** seriali: sei homepage esistenti, sei flussi menu/carrello
  Aurora/Nodo a 1440/390/320 px, isolamento con copia ostile dello storage,
  storage corrotto/disabilitato e configurazioni diverse/limiti quantità.
- I flussi verificano tastiera sui dettagli, min/max, extra esauriti, prezzi,
  aggiunta ripetuta, quantità, rimozione, refresh e assenza di errori JavaScript.
  Screenshot completi di menu, configurazione, carrello popolato e vuoto in
  `tavolyn-qwik/.wrangler/browser-results/`, esclusi da Git e rivisti visivamente.
- Menu impaginati con tipografia serif e terracotta per Aurora, sans-serif e
  verde/lime per Nodo; categorie e schede responsive, focus/disabled espliciti,
  fieldset/legend, etichette quantità e feedback `role="status"`.
- Build iniziale verificata: **230.36 KiB, gzip 66.71 KiB**. Dry run, nessun upload.
- `npm audit`: 10 segnalazioni note (8 moderate, 2 high), exit 1;
  `npm audit --omit=dev`: zero, exit 0. Nessun aggiornamento applicato.
- Query Wrangler sul database locale: 10 categorie, 27 prodotti, 19 gruppi,
  56 modificatori e 2 migrazioni registrate.
- `git diff --check` superato; migrazione iniziale e lockfile invariati.
  Controllati 79 file pubblicabili: nessun output di build, screenshot, database,
  log, profilo o file privato incluso. Nessuna corrispondenza ai pattern cercati
  di chiavi private/token; è un controllo mirato, non una certificazione generale.
  Nessuna query SQL, `tenant_domains` o riferimento al servizio catalogo nei
  bundle JavaScript client controllati.

I log sono locali sotto `.wrangler/TAV-MVP-03-*.log`. La suite Vitest usa D1 e il
Worker compilato, senza mock degli handler; i test browser avviano Wrangler e
chiudono il server alla fine. Il profilo del runtime non è stato alterato.
Prima del gate fermare anche eventuali `dev`/`cf:dev` manuali: una compilazione
concorrente svuota e rigenera `dist/`, invalidando il preview dei test. Durante
questa verifica il primo gate completo si è fermato per `_worker.js` assente
mentre un avvio manuale ricompilava; il processo manuale è stato fermato
dall'utente prima della verifica finale, senza cambiare il codice per aggirarlo.
Corrette anche le attese di due test browser: attendere il decremento della
quantità prima di digitare e il recupero iniziale prima di manomettere lo storage.
I due casi sono passati tre volte in sequenza, poi nell'intera suite, senza
retry o pause artificiali. Nessuna modifica applicativa necessaria per quei casi.

## File modificati o aggiunti

| File nel workspace Qwik, salvo indicazione | Intervento |
| --- | --- |
| `migrations/0002_catalog.sql`, `seeds/demo-catalog.sql` | Schema incrementale e cataloghi fittizi ripetibili |
| `src/lib/server/catalog/catalog-service.ts` | Lettura D1 isolata e gestione errori |
| `src/lib/shared/catalog.ts`, `src/lib/shared/cart.ts` | DTO, configurazione, prezzi indicativi e recupero storage |
| `src/routes/api/public/menu/index.ts` | GET pubblico nativo Qwik City |
| `src/routes/(shop)/layout.tsx`, `menu/index.tsx`, `cart/index.tsx` | Loader, shell, menu e carrello |
| `src/components/catalog/product-card.tsx`, `src/components/cart/cart-context.ts` | Configuratore e contesto reattivo |
| `src/routes/index.tsx`, `src/global.css` | Navigazione homepage e stile dei due temi |
| `tests/worker.test.ts`, `tests/cart.test.ts`, `tests/browser/catalog.spec.ts` | Integrazione, validazione e flussi browser |
| `package.json`, `eslint.config.js`, `.prettierignore` | Seed locale e inclusione dei sorgenti nei controlli |
| `README.md` radice/workspace, `docs/mvp/README.md`, `02-data-and-http-contracts.md`, `03-ux-and-acceptance.md`, questo resoconto | Setup, contratti, perimetro ed evidenza |

## Limiti e consegna

Verifica Chromium desktop/mobile simulato, non Safari o smartphone fisico.
Non c'è sincronizzazione del carrello fra dispositivi o schede già aperte;
ricaricando si legge lo stato persistito e il catalogo corrente. I prezzi non
sono congelati nello storage: eventuali edit D1 si riflettono al caricamento.

Restano le advisory della toolchain Qwik/ESLint documentate in TAV-MVP-01/02,
senza aggiornamenti forzati. L'audit npm che esclude le dipendenze dev non è una
certificazione del Worker. Il budget CPU Free va verificato su un futuro deploy
autorizzato: test locali e dimensione bundle non misurano la CPU cloud.

Nessun deployment pubblico, provisioning, invio email, servizio a pagamento o
cambio billing. La consegna Git segue AGENTS: commit su `develop` con firma
disabilitata, push normale e confronto SHA locale/remoto nel resoconto finale.

## Fonti tecniche

- [D1: vincoli foreign key](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
- [D1: statement preparati](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [Qwik: task e lifecycle](https://qwik.dev/docs/core/tasks/)
- [Workers: best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- Tipi D1, route loader e primitive Qwik verificati anche nei pacchetti installati.
