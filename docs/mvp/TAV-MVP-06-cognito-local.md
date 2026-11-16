# TAV-MVP-06 — Collegamento locale al Cognito esistente

Follow-up del 16 novembre 2026, a partire da `456bfa7`, su `develop` inizialmente
pulito e allineato a `origin/develop`. Un solo agente, nessun subagente.
Nessuna risorsa AWS/Cloudflare creata o modificata, nessun deploy o billing.
Client OIDC, PKCE, verifica firma/claim, cookie e autorizzazioni non sono cambiati.

## Configurazione privata e dati personali

Questo checkout usa **`http://localhost:8787`**, tenant Aurora. La callback è
**`http://localhost:8787/api/auth/callback`**, senza slash finale. Usare letteralmente
`localhost`: `127.0.0.1` e `aurora.localhost` sono origini differenti e non sono
callback automaticamente autorizzate dal client Cognito esistente.

Le impostazioni reali restano esclusivamente nei file locali ignorati:

- `tavolyn-qwik/.wrangler/local-cognito.json`: issuer, client ID, origine, subject
  staff, tenant e ruolo; contiene metadati personali, **nessuna password**.
- `tavolyn-qwik/.dev.vars`: impostazioni OIDC e chiave privata `AUTH_STATE_KEY`.
  La riga `ORDER_TOKEN_KEY` preesistente è conservata integralmente.
- D1 sotto `tavolyn-qwik/.wrangler/state/`: membership personale aggiunta solo
  qui. Le quattro membership fixture rimangono invariate.

Nessun identificativo reale del pool/client/utente è necessario nei seed o nella
configurazione versionata. `wrangler.jsonc` mantiene issuer/client vuoti e
allowlist vuota: una clone senza configurazione privata non attiva Cognito.

Per predisporre un altro checkout, ottenere i valori **dalle risorse già
esistenti**, senza crearne altre: issuer dai dettagli/discovery del User Pool,
Client ID dai dettagli dell'App Client, `sub` dai dettagli dell'utente staff nel
pool. Il dominio Managed Login non è l'issuer. Il ruolo applicativo qui scelto
è OWNER per Aurora; non viene preso dai gruppi Cognito.

Creare il JSON privato indicato sopra nel proprio editor, sostituendo i segnaposto:

```json
{
  "issuer": "<issuer OIDC verificato del pool esistente>",
  "clientId": "<ID del client esistente>",
  "origin": "http://localhost:8787",
  "subject": "<attributo sub UUID dello staff>",
  "tenantSlug": "aurora",
  "role": "OWNER"
}
```

I segnaposto non sono configurazioni utilizzabili. Non inserire username,
password, token o credenziali AWS amministrative nel file o nei comandi.
In questa macchina il file privato è già stato predisposto con i parametri
forniti dal proprietario; non occorre ricrearlo o copiare valori dalla chat.

## Setup ripetibile, esclusivamente locale

Dalla radice, Node 22.16.0/npm 10.9.2 (PowerShell: `npm.cmd` se necessario):

```sh
# Solo su checkout non ancora installata / D1 non inizializzata:
npm ci
npm run db:setup
npm run checkout:setup

# Configurazione reale dal file privato; non invoca API AWS amministrative:
npm run auth:setup-local -- .wrangler/local-cognito.json
npm run cf-typegen
npm run dev
```

L'argomento del setup è relativo al **workspace `tavolyn-qwik`**, anche quando
il comando parte dalla radice. È possibile fornire un percorso assoluto.
La D1 deve essere già inizializzata; non si modificano schema o migrazioni.
`checkout:setup` non sovrascrive `.dev.vars`: se il file esiste e manca la
chiave degli ordini, seguire prima il setup privato di TAV-MVP-04.
Fermare preview manuali prima delle build; non compilare la stessa dist da due
processi contemporaneamente. `npm run preview` avvia una build già presente.

`auth:setup-local` esegue `scripts/setup-local-oidc.mjs`:

1. Valida input, origine HTTP localhost e file privato; rifiuta file symlink,
   definizioni duplicate delle variabili gestite e chiavi esistenti non valide.
2. Usa il binding esistente con `getPlatformProxy({remoteBindings:false})`:
   niente database remoto, account AWS o credenziali amministrative.
3. Conserva le righe non pertinenti di `.dev.vars` e l'intera riga della chiave
   ordini. Genera `AUTH_STATE_KEY` con `randomBytes(32)` solo se assente; un valore
   auth valido preesistente non viene ruotato. File 0600 dove supportato; su
   Windows proteggere il workspace tramite le proprie ACL.
4. Imposta le tre variabili OIDC private e inserisce la sola membership richiesta
   con parametri bindati e conflitto ignorato. Un record esistente con ruolo
   diverso o disabilitato fa fallire il setup, senza riattivarlo/sovrascriverlo.
5. Stampa solo un messaggio riepilogativo, senza subject, valori o hash delle chiavi.

Il setup è ripetibile: non resetta fixture, sessioni o ordini. Non pubblicare
né allegare `.dev.vars`, JSON privato, database o diagnostica sotto `.wrangler`.

## Correzione del caricamento segreti

Wrangler 4.162.0 ha una lista `secrets.required` esplicita. Il caricamento locale
esclude i nomi aggiuntivi non dichiarati (salvo le chiavi già presenti in `vars`).
`AUTH_STATE_KEY`, prima assente dalla lista, veniva esclusa: creare la sola riga
nel file non era sufficiente. La lista ora include **ORDER_TOKEN_KEY e
AUTH_STATE_KEY**, senza valori. Tipi rigenerati, non modificati manualmente.

Le impostazioni OIDC sovrascrivono localmente le corrispondenti `vars` vuote.
Nessun valore privato viene inserito nelle variabili Vite o nel bundle client.
Su una clone senza chiave auth Wrangler può segnalare il nome mancante: il
login configurato rimane fail closed, mentre quello non configurato resta disabilitato.
Non usare `wrangler secret put` per questo setup: comporterebbe operazioni cloud.

## Verificato automaticamente in questa consegna

- Discovery OIDC reale: HTTP 200, issuer esatto e authorization/token endpoint
  coerenti con Managed Login fornito dal proprietario; code flow e RS256
  dichiarati. JWKS HTTP 200 con due chiavi pubbliche RSA/RS256, nessuna chiave
  privata richiesta o acquisita.
- Setup eseguito due volte e poi anche tramite il comando npm documentato:
  configurazione privata caricata, chiave auth di 32 byte valida, riga chiave
  ordini identica, nessuna rotazione auth al secondo passaggio e nessuna modifica
  a membership preesistenti. Cinque membership locali: quattro fixture più quella
  personale OWNER attiva in Aurora. Nessun dato personale aggiunto ai seed.
- Typecheck superato; lint superato. Un avvio lento di ESLint è stato arrestato e
  rieseguito con gli stessi target e diagnostica `--debug`, senza cambiare regole.
- `npm run build`: exit 0, inclusi typecheck/lint e bundle Workers dry run;
  **302.00 KiB / gzip 86.13 KiB**, nessun upload.
- `vitest run tests/auth.test.ts`: **40 test passati**, nessuno saltato; sono
  regressioni sul provider locale firmato, **non** un login Cognito personale.
  Suite guest/UI immutate non ripetute; la loro evidenza precedente resta nel
  resoconto originario TAV-MVP-06.
- `npm run preview` e richieste HTTP sul Worker locale compilato, usando la
  configurazione privata reale: health 200, sito Aurora, `/login/` 200 con il
  pulsante provider e `/api/staff/me` 401 senza sessione.
- `/api/auth/login` restituisce 302 con endpoint atteso, client ID esatto,
  callback esatta, `response_type=code`, scope openid, nonce/state e PKCE S256.
  Cookie locale di correlazione HttpOnly/Lax/Path=/, senza Domain/Secure;
  no-store e no-referrer presenti. Nessun valore cookie/state/nonce viene loggato.
- Seguendo soltanto redirect HTTPS sul Managed Login atteso si ottiene HTML
  **HTTP 200**. È una verifica HTTP della pagina bootstrap, non del rendering
  interattivo: nell'HTML statico non è stato rilevato un input password, e non
  sono stati eseguiti JavaScript del provider né inviate credenziali.
- Callback di diniego `access_denied` correlato: 303 verso l'errore locale,
  cookie di correlazione cancellato, nessuna sessione emessa, replay rifiutato.
  Prova negativa applicativa con discovery reale, **non** token exchange riuscito.
  Avvio login da `127.0.0.1` rifiutato perché fuori dall'origine consentita.
- Il preview avviato per questi controlli è stato arrestato. Per il controllo
  personale avviarlo nuovamente con `npm run dev` o, senza ricompilare, `npm run preview`.
- D1 finale: cinque membership, zero sessioni applicative e zero transazioni
  login residue. Nessun accesso personale viene dichiarato riuscito.
- `git diff --check` superato; lockfile, migrazioni, seed e moduli applicativi
  OIDC/sessione invariati. Controllati 129 file pubblicabili e i bundle emessi:
  nessuna corrispondenza ai valori personali forniti o alle chiavi private.
  Nessuna chiave privata nei log di questa verifica. Configurazione locale,
  input personali e diagnostica risultano ignorati da Git. È una scansione
  mirata ai valori noti, non una certificazione generale di sicurezza.

Log diagnostici di build/lint e regressione rimangono sotto `.wrangler/`, ignorati;
non contengono valori delle chiavi. Lo smoke HTTP stampa soltanto status e
booleani; header di redirect, HTML Cognito e cookie sono elaborati solo in memoria.
Non si usano tracce browser/HAR del login personale.

## Verifica manuale nel browser, ancora necessaria

Con `npm run dev` attivo, aprire **`http://localhost:8787/login/`** e selezionare
“Accedi con il provider”. Completare l'accesso esclusivamente sulla pagina HTTPS
di **Cognito Managed Login del pool esistente**, controllandone il dominio.

Se Cognito richiede il primo cambio della password temporanea, scegliere la
password definitiva direttamente lì. Completare eventuali MFA/challenge previsti
dal pool. Non comunicare password a Codex, non salvarle nei file locali e non
effettuare registrazioni HAR/trace del login personale.

Dopo il ritorno alla callback verificare:

1. `/login/` mostra “Sessione attiva”, Aurora e ruolo OWNER.
2. Aprendo `/api/staff/me` nello stesso browser si riceve 200, ruolo OWNER,
   `order.read` e `order.manage`, senza token o identificativo di sessione.
3. Il cookie locale è `tavolyn-local-session`, HttpOnly, SameSite=Lax, Path=/,
   senza Domain e senza Secure perché questa preview è HTTP. Non viene indebolita
   la policy HTTPS `__Host-`/Secure del Worker.
4. “Esci” elimina il cookie e revoca D1; `/api/staff/me` torna 401.

Il logout termina la sessione Tavolyn, non quella SSO Cognito: un nuovo login
può riutilizzare la sessione del provider. Non è ancora implementata una dashboard.

Un errore `invalid_client` al callback può richiedere di controllare il tipo
effettivo di App Client: i parametri forniti non includono un client secret.
Non è stata modificata la configurazione AWS per aggirarlo. Un eventuale client
confidential richiede la gestione privata di `OIDC_CLIENT_SECRET` e la sua
dichiarazione di caricamento in Wrangler; non è stato configurato senza un valore
fornito dal proprietario. Non incollare segreti o URL con codici/state nel resoconto.

## Fonti

- [Caricamento locale e secrets.required](https://developers.cloudflare.com/workers/configuration/secrets/#local-development-with-secrets)
- [Cognito authorization endpoint e PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)
- [Contratto applicativo e sicurezza OIDC](./TAV-MVP-06.md)
