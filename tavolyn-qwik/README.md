# Tavolyn — workspace Qwik City

Qwik/Qwik City **1.20.0**, adapter ufficiale Cloudflare Workers, un solo Worker
per pagine e API. I moduli dell'adapter conservano il nome `cloudflare-pages`
previsto dal template ufficiale 1.20; non viene usato un progetto Cloudflare Pages.

Seguire il [README principale](../README.md) per installazione, sviluppo, test
e build dalla radice del monorepo. Consultare il
[resoconto TAV-MVP-01](../docs/mvp/TAV-MVP-01.md) per decisioni e limiti verificati.
Schema D1, alias locali e prove di isolamento sono nel
[runbook TAV-MVP-02](../docs/mvp/TAV-MVP-02.md).

Dentro questo workspace, dopo `npm ci` dalla radice:

```sh
npm exec -- playwright install chromium
npm run db:setup
npm run build
npm test
npm run test:browser
npm run preview
```

Il runtime locale è Wrangler/workerd su <http://127.0.0.1:8787/>. `dev:vite`
rimane uno strumento HMR opzionale, non una verifica del runtime Workers.
Non esistono preview server Node o backend separati da avviare.
Le due homepage sono su `aurora.localhost:8787` e `nodo.localhost:8787`.
