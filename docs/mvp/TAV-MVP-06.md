# TAV-MVP-06 — OIDC staff e sessioni D1, validazione locale

## Perimetro e architettura

Base `bc21aa0727e014482fbd6bb9a940789e94b78527`, `develop` inizialmente pulito
e allineato a `origin/develop` dopo fetch. Un solo agente, attività seriali,
nessun subagente. Qwik/Qwik City 1.20.0, Wrangler 4.162.0 e un solo Worker
applicativo restano invariati. Nessuna configurazione AWS o pubblicazione cloud.

Client **oauth4webapi 3.8.8**, dipendenza runtime fissata nel lockfile, senza
dipendenze proprie e con supporto dichiarato Cloudflare Workers. Gestisce
discovery OIDC, Authorization Code, PKCE S256, validazione della risposta,
claim e JWKS. Si invoca esplicitamente anche `validateApplicationLevelSignature`:
la firma è obbligatoria per Tavolyn anche sul canale token TLS. Solo **RS256**,
compatibile con Cognito; non si accettano algoritmi scelti dal token.
Web Crypto standard genera i segreti temporanei e cifra lo stato con AES-256-GCM.
Non viene implementata una crittografia JWT alternativa.

Il provider simulato è esclusivamente in `tests/oidc/`. Emette veri codici monouso,
verifica PKCE e firma ID Token con una coppia RSA effimera generata a ogni avvio.
Non esistono password, account AWS o chiavi private fixture versionate.
Lo stesso client server nel Worker opera con mock e provider futuro: cambia
soltanto la configurazione. Non ci sono endpoint di impersonificazione,
`dev-login`, flag pubblici di bypass o verifica firma disattivabile.

## D1 e fixture

Migrazione incrementale `0005_staff_auth.sql`, precedenti migrazioni invariate:

| Tabella | Contratto |
| --- | --- |
| `staff_memberships` | PK `(tenant_id,cognito_sub)`, FK tenant, ruolo OWNER/OPERATOR, active 0/1, indice subject/tenant |
| `app_sessions` | PK hash SHA-256 della sessione, subject, tenant, issuer, origine esatta, creazione/scadenza/revoca; FK composita membership |
| `oidc_login_transactions` | Hash state e correlazione browser, tenant/origine/issuer/client/redirect esatti, payload cifrato nonce/verifier e scadenza |

Il nome `cognito_sub` conserva il contratto dati; il valore è il subject OIDC
verificato, anche con il provider locale. Unico issuer attendibile per ambiente.
Ruoli e claim personalizzati del provider non assegnano autorizzazioni.

`seeds/demo-staff.sql` è eseguito solo dagli script D1 `--local`: quattro
membership, inserite solo nei tenant fittizi marcati `is_demo=1`, con conflitti
ignorati per preservare ruoli e revoche già esistenti. Non è un reset.

| Subject fittizio | Tenant | Ruolo | Attivo |
| --- | --- | --- | --- |
| `fixture-aurora-owner` | Aurora | OWNER | sì |
| `fixture-aurora-operator` | Aurora | OPERATOR | sì |
| `fixture-nodo-operator` | Nodo | OPERATOR | sì |
| `fixture-disabled` | Aurora | OPERATOR | no |
| `fixture-unassigned` | nessuno | nessuno | nessuna membership |

Questi nomi sono fixture, non credenziali pubbliche: senza un ID Token firmato
dal provider attendibile il Worker non li autentica. Non importarli come utenti
reali Cognito. Le membership reali dovranno usare i subject reali verificati.

## Configurazione attendibile e flusso

Le variabili base sono vuote: il normale `npm run dev` mostra il login indisponibile.
`GET /api/auth/login` restituisce 503 in assenza di configurazione, senza mock automatici.

| Nome | Provenienza e uso |
| --- | --- |
| `OIDC_ISSUER` | Issuer OIDC esatto scelto dal proprietario, non la URL Managed Login |
| `OIDC_CLIENT_ID` | ID del client registrato dal proprietario |
| `OIDC_ALLOWED_ORIGINS` | Array JSON di origini esatte approvate, senza path o slash finale |
| `AUTH_STATE_KEY` | Segreto privato casuale: 32 byte, 64 caratteri hex; non inserire in `vars` versionate |
| `OIDC_CLIENT_SECRET` | Segreto privato opzionale, solo per client confidential; HTTP Basic al token endpoint |

I nomi opzionali dei segreti sono tipizzati in `AuthEnv`; i binding e le variabili
pubbliche restano generati con `cf-typegen`. Non sono duplicati binding D1/ASSETS.
Manca un segreto richiesto dalla configurazione OIDC: fail closed 503.
Non si leggono né sovrascrivono `.dev.vars` o chiavi degli ordini esistenti.

1. Il resolver D1 esistente risolve l'hostname della Request. Query, header
   proxy, cookie e body non selezionano il tenant.
2. Il login rifiuta query arbitrarie; richiede origine nella allowlist e HTTPS.
   Discovery e tutti gli endpoint provengono dal provider configurato, mai dal browser.
3. Genera state/correlazione a 256 bit, nonce e verifier casuali. Persistenza di
   **5 minuti**: hash state/browser, nonce e verifier cifrati con IV GCM casuale
   e AAD legata a hash state, tenant, origine, issuer, client e callback.
4. Cookie di correlazione HttpOnly; redirect al provider con scope `openid`,
   codice, state, nonce e challenge S256. Il verifier non arriva al browser.
5. Callback: controlla state/cookie, origine/tenant/configurazione/scadenza.
   `DELETE ... RETURNING` consuma atomicamente la transazione prima del token
   exchange: anche errori del provider richiedono un nuovo login. Replay/race
   non possono scambiare il codice due volte. Il ciphertext consumato è eliminato.
6. Verifica PKCE, issuer, audience/client, algoritmo, firma/JWKS, nonce, exp/nbf
   e iat non futuro e non più vecchio di cinque minuti; tolleranza clock zero.
7. Solo una membership D1 attiva può creare una sessione. Inserimento condizionato
   all'attivazione anche dopo il token exchange; sessione nuova casuale, precedente
   sessione locale revocata. Destinazione fissa `/login/`, nessun return URL libero.

Discovery, token e JWKS hanno una scadenza complessiva di cinque secondi per
operazione client e risposte limitate a 64 KiB. Fetch con redirect manuale:
ogni 3xx del provider è rifiutato. Nessun inoltro di credenziali a redirect inattesi.
Metadata e chiavi sono acquisiti nel contesto della richiesta; non c'è stato
utente globale condiviso. Errori pubblici sanitizzati; nessun logger di token,
codici, cookie, subject o risposte del provider.

Gli state scaduti del tenant sono rimossi al successivo login. Senza nuovi login
non c'è pulizia automatica: scadenza comunque verificata in ogni callback.

## Sessioni, cookie e autorizzazione

Durata assoluta **un'ora**, senza sliding expiration o rinnovo. Alla scadenza,
revoca o cambio issuer: 401 e nuovo passaggio OIDC. Access token, ID Token e
refresh token del provider sono usati solo in memoria durante il callback e
scartati: niente token nei cookie, nel DB, HTML/JSON, storage o log applicativi.
La sessione browser è un identificativo casuale opaco; D1 conserva solo SHA-256.

HTTPS: `__Host-tavolyn-session`, `HttpOnly; Secure; SameSite=Lax; Path=/`, senza
Domain; correlazione `__Host-tavolyn-login` con la stessa policy e TTL cinque minuti.
Cookie di sessione con Max-Age 3600 e scadenza assoluta coerente con D1.

HTTP locale è un'eccezione esplicita: occorrono `LOCAL_DEMO_MODE=true`, tenant
risolto e hostname loopback consentito. Cookie `tavolyn-local-session` e
`tavolyn-local-login`, HttpOnly/Lax/Path=/ e senza Domain, senza Secure perché
HTTP. Non si usa il prefisso `__Host-` su HTTP. La configurazione pubblica
rifiuta questi alias. Un issuer HTTP è ammesso soltanto in tale contesto e
solo su loopback; la verifica dei token rimane identica. Nessun downgrade HTTPS.

`requireStaff(event, capability?)` restituisce un contesto **server-only** con
subject verificato, tenant ID e DTO appropriato. Controlla hash/formato sessione,
esistenza, issuer, scadenza, revoca, tenant/origine e membership attuale, ogni volta.
`requireStaffMutation` aggiunge il controllo CSRF. Entrambi i ruoli ricevono
`order.read` e `order.manage`; nessuna dashboard o operazione ordini implementata.

`GET /api/staff/me`: 401 sessione assente/non valida, 403 sessione valida con
membership non attiva o tenant/origine differente, 200 autorizzato. DTO: etichetta
di ruolo (senza nome/email del provider), tenant pubblico, ruolo/capabilities
e scadenza; nessun subject, hash o identificativo di sessione. Problemi D1: 503.

Mutazioni: Origin obbligatorio e identico alla Request, niente `null`, assenza
o `Sec-Fetch-Site: cross-site`; in aggiunta a SameSite, controlli Qwik e tenant.
Non c'è un'esenzione CSRF locale. `POST /api/auth/logout` revoca D1 e cancella
cookie sessione/correlazione con gli stessi attributi di creazione. Con
`Accept: application/json` risponde 200 `{loggedOut:true}`; altrimenti 303
verso `/login/?result=logged-out`. Il cookie precedente non torna utilizzabile.

La pagina usa fetch same-origin per il logout: un form di navigazione con policy
`no-referrer` può produrre `Origin: null`, correttamente rifiutato. Non si indebolisce
il controllo Origin per far passare il form. Errori consentono retry esplicito.
Auth/staff/login hanno no-store, no-referrer e noindex; invocation log e trace
automatiche restano disabilitati per non registrare URL di callback o tracking.

## Avvio e test riproducibili senza AWS

Node 22.16.0/npm 10.9.2. Dalla radice (PowerShell: `npm.cmd` se necessario):

```sh
npm ci
npm exec --workspace tavolyn-qwik -- playwright install chromium
npm run db:setup
npm run checkout:setup
npm run cf-typegen
npm run check
```

Fermare preview manuali prima di build/gate: porte 8787 e 8788 libere e nessuna
compilazione concorrente della stessa dist. Il setup locale ora applica cinque
migrazioni e quattro seed non distruttivi; i vecchi ordini restano intatti.

Normale preview, provider non configurato:

```sh
npm run cf:dev
```

Aprire `/login/` su Aurora/Nodo porta 8787: indisponibilità esplicita, nessun
pulsante simulato. Guest menu/checkout/tracking continuano a funzionare.

Provider fixture interattivo, separato dal normale preview e senza AWS:

```sh
npm run build
npm run auth:preview
```

Aprire `http://aurora.localhost:8788/login/` o `http://nodo.localhost:8788/login/`.
Il pulsante conduce alla pagina del provider **di test**, dove si sceglie il
subject fixture. Autorizzare e tornare alla sessione Tavolyn; provare gli
operatori, un'identità senza membership, Nodo su Aurora e logout.
Ctrl+C arresta il test harness. Non usare dati personali.

Il runner compila soltanto il test harness in `.wrangler/oidc-harness/`, avvia
IdP su loopback/porta effimera e Wrangler locale su 8788 con **lo stesso Worker
compilato**. Configurazione privata generata in `.wrangler/oidc-test/wrangler.json`,
DB separata sotto `.wrangler/oidc-test/state/`. Segreti effimeri generati dal
runner; nessuna lettura del `.dev.vars` principale. Le sessioni del test harness
non sono garantite fra riavvii, poiché issuer/chiavi effimeri cambiano.

La build applicativa non importa il test harness o il provider; gli asset non
contengono il loro output. La configurazione base ha OIDC disattivato. Non
pubblicare mai configurazione generata, directory `.wrangler`, trace o log
diagnostici privati. L'IdP fittizio non è un secondo backend applicativo.

Suite mirate, richiedono prima la build:

```sh
npm test --workspace tavolyn-qwik -- tests/auth.test.ts
npm run test:auth:browser
```

`npm run check` esegue anche le regressioni precedenti: Vitest sul Worker
compilato e D1 isolata, poi browser guest/unconfigured su 8787, poi OIDC su 8788,
un worker di test, nessun retry. Solo concorrenza interna al caso replay per
provare il consumo atomico, nessuna delega o attività distinta parallela.

## Configurazione AWS Cognito da effettuare successivamente

**Solo checklist manuale per il proprietario; niente di quanto segue è stato
eseguito. Il collegamento reale Cognito rimane non verificato.**

1. Valutare costi/piano, quote e sicurezza prima di autorizzare risorse. Scegliere
   un User Pool unico per lo staff; niente registrazione pubblica degli ospiti.
2. Registrare un App Client per Authorization Code, PKCE S256, scope `openid`.
   Preferibile client pubblico senza secret per questo MVP; un client confidential
   usa `OIDC_CLIENT_SECRET` privato. Non abilitare implicit/password grant.
3. Configurare Managed Login e relativo dominio approvato, metodi di accesso e
   MFA secondo policy. Creare solo gli utenti staff voluti dal proprietario.
4. Copiare l'issuer dai dettagli effettivi del User Pool/discovery, e il Client ID
   dai dettagli dell'App Client. Non confondere issuer con dominio Managed Login.
5. Registrare **esattamente** una callback `origine approvata + /api/auth/callback`
   per ogni ristorante. Inserire quelle origini in `OIDC_ALLOWED_ORIGINS`; hostname
   già approvati anche in `tenant_domains`. HTTPS pubblico obbligatorio.
6. Registrare come Allowed sign-out URL la pagina `/login/` su ogni origine
   approvata. Il logout implementato qui termina **la sessione Tavolyn**; non
   invoca il logout specifico di Cognito e non termina la sessione SSO del provider.
   Non promettere global logout: un nuovo login può utilizzare la sessione IdP.
7. Generare una chiave privata distinta `AUTH_STATE_KEY` con CSPRNG, 32 byte,
   conservarla nella configurazione privata/secrets dell'ambiente approvato,
   mai in Git o browser. Localmente si può usare il proprio editor su `.dev.vars`;
   non sostituire `ORDER_TOKEN_KEY`. La rotazione della chiave auth invalida i
   login in corso, non le sessioni già create. Un eventuale client secret va
   ottenuto dall'App Client e gestito nello stesso modo privato.
8. Inserire in D1 le membership dei subject **reali** ottenuti dal User Pool,
   con tenant corretto e ruolo scelto dal proprietario. Non usare email come
   identità e non assegnare ruoli dai gruppi/claim Cognito. Non attivare fixture
   come utenti reali. Qualsiasi scrittura remota richiede autorizzazione separata.
9. Dopo un deploy separatamente autorizzato, verificare discovery e TLS, login,
   firma e claim, callback su entrambi i tenant, cookie HTTPS host-only, `/me`,
   401/403, membership disabilitata, scadenza e logout/replay. Controllare che
   edge/proxy/log esterni non registrino codici o cookie. Misurare CPU cloud.

Nessun cloud ID, dominio di produzione inventato o credenziale è incluso nel
repository. Le URL localhost nelle istruzioni sono esplicitamente solo test.

## Verifiche effettivamente eseguite

- `npm ci`: exit 0, 478 pacchetti installati / 480 verificati. Lockfile con
  sola aggiunta runtime oauth4webapi 3.8.8, confermata anche da `npm ls`.
- `npm run cf-typegen`: exit 0, variabili OIDC generate; binding esistenti invariati.
- **`npm run check`: exit 0**, TypeScript strict, lint, build Workers dry run,
  **145 test Vitest e 40 test browser** (33 guest/login non configurato, poi 7
  OIDC), nessun caso saltato e nessun retry. Log privato
  `.wrangler/TAV-MVP-06-check-final.log`.
- La sola sistemazione finale del contenitore/margini e dell'altezza del tema
  login è stata verificata con un'altra build e i **4+7 test browser auth**.
  Anche i **40 test Vitest auth** sono stati rieseguiti dopo aver reso la fixture
  di sessione scaduta indipendente dai millisecondi dell'esecuzione. Regressioni
  guest immutate non ripetute. Log `.wrangler/TAV-MVP-06-final-*.log`.
- Bundle finale **302.00 KiB / gzip 86.13 KiB**, solo dry run, nessun upload.
- Flusso code/PKCE con vero scambio HTTP, codici monouso e firma RSA; OWNER e
  OPERATOR di entrambi i tenant, claim ruolo ostili ignorati, persistenza di
  sessione solo dopo membership attiva. Il test non simula il risultato finale.
- State mancante/alterato/scaduto, correlazione browser assente/alterata,
  ciphertext manomesso, callback ripetuto e due callback simultanei con un solo
  token exchange; tenant/origine cambiati e host non autorizzati rifiutati.
- Nonce errato, firma falsa, issuer/audience errati, exp scaduto, nbf futuro,
  algoritmo non consentito, kid sconosciuto, errore token, PKCE rifiutato,
  autorizzazione negata, discovery 503 e timeout: nessuna sessione creata.
- Formato/cookie/sessione inesistente, sessione scaduta/revocata, session
  fixation, membership disabilitata durante la sessione, logout con riuso del
  vecchio cookie e risposte me 200/401/403. Test dei due formati di risposta logout.
- CSRF: Origin assente/ostile/altro tenant e Sec-Fetch-Site cross-site rifiutati;
  form realmente proveniente da Nodo verso Aurora rifiutato anche nel browser.
  Cookie HTTP locale HttpOnly/host-only/Lax, cancellazione e assenza di sessione
  sull'altro hostname verificati in Chromium. Policy HTTPS `__Host-`/Secure
  verificata a livello unitario, **non con un browser su TLS reale**.
- Seed e migrazione ripetuti, revoche manuali preservate, ruoli/FK invalidi
  rifiutati. Database locale ordinario: **5 migrazioni / 4 membership fixture /
  0 sessioni / 0 transazioni login**, separato dalla D1 del test harness.
- Screenshot finali Aurora/Nodo 1440/390 px, stato autenticato e disconnesso,
  indisponibilità e recupero errore; controllo visivo e assenza di overflow/errori
  JavaScript. Output privati in `.wrangler/browser-results/` e
  `.wrangler/auth-browser-results/`; nessun preview sulle porte 8787/8788 rimasto attivo.
- `npm audit`: exit 1, **10 segnalazioni note (8 moderate / 2 high)**.
  `npm audit --omit=dev`: exit 0, zero; nessun aggiornamento forzato. La
  classificazione dev non certifica il bundle Qwik, che ne include parte del codice.
- `git diff --check` superato; migrazioni 0001–0004 invariate. Scansione mirata
  di **127 file pubblicabili**: nessun file privato, database, build, screenshot,
  trace/log o profilo; nessuna corrispondenza ai pattern di credenziali cercati.
  Nei bundle client controllati non compaiono chiavi auth, tabelle auth o fixture;
  nel Worker controllato non compaiono il provider/identità/client ID del mock.
  Sono controlli mirati, non una certificazione generale di sicurezza.

## File della consegna

Migrazione 0005 e seed staff; `src/lib/server/auth/{config,crypto,oidc,sessions,http}.ts`;
DTO `src/lib/shared/staff.ts`; quattro route auth/me, pagina login, middleware
privacy e CSS dedicato; variabili/tipi Wrangler; dipendenza/lockfile e script npm;
test auth Vitest, provider/runner/config del test harness, due suite browser e
config Playwright separata; README e contratti/runbook MVP aggiornati.
Nessuna modifica ai servizi guest, pagamenti, email o precedenti migrazioni.

## Limiti e retention

Non ci sono dashboard/azioni ordini, amministrazione ruoli, rinnovo sessioni,
global logout IdP o invio email. Sessione rubata resta una credenziale bearer
fino a revoca/scadenza: HTTPS, HttpOnly, host-only, durata limitata e assenza di
token nel browser riducono l'esposizione, non eliminano il rischio.

La disattivazione membership nega immediatamente l'accesso; riattivarla può
riabilitare sessioni ancora valide se non revocate. Per revoca permanente usare
anche `revoked_at`. Non si effettua automaticamente alcun reset degli ordini.
Sessioni scadute/revocate non sono ripulite automaticamente in questo task;
prima del deploy definire una retention corta e una pulizia autorizzata per
metadati sessione e transazioni scadute. Anti-abuso/login throttling e CPU
Workers Free restano gate del futuro deploy. Questi test non certificano AWS,
TLS di produzione, Safari o un dispositivo fisico.

## Riferimenti primari

- [oauth4webapi: runtime e documentazione](https://github.com/panva/oauth4webapi)
- [Verifica esplicita delle firme](https://github.com/panva/oauth4webapi/blob/main/docs/functions/validateApplicationLevelSignature.md)
- [OIDC Core: ID Token validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)
- [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html)
- [Cognito PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html)
- [Cognito token endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html)
- [Cognito managed logout](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html)
- [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
