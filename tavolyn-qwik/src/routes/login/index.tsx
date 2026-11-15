import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { getRequestTenant } from "../../lib/server/tenants/tenant-service";
import { authConfig, AuthError } from "../../lib/server/auth/config";
import { staffIdentity } from "../../lib/server/auth/sessions";
import type { StaffIdentity } from "../../lib/shared/staff";

export const useLogin = routeLoader$(async (event) => {
  const tenant = getRequestTenant(event);
  let enabled = false;
  let identity: StaffIdentity | null = null;
  let notice = "";
  try {
    enabled = !!authConfig(
      event.platform.env,
      tenant,
      new URL(event.request.url),
    );
  } catch {
    notice = "Accesso temporaneamente non disponibile. Riprova più tardi.";
  }
  try {
    identity = await staffIdentity(event);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403)
        notice =
          "Accesso negato: la membership per questo ristorante non è attiva.";
      if (error.code === "SESSION_EXPIRED")
        notice = "Sessione scaduta o revocata. Accedi nuovamente.";
    } else {
      notice = "Sessione temporaneamente non verificabile. Riprova più tardi.";
    }
  }
  const result = event.url.searchParams.get("result");
  if (result === "denied")
    notice =
      "Accesso negato: questa identità non è autorizzata per il ristorante.";
  if (result === "failed")
    notice =
      "Accesso non riuscito. Il collegamento potrebbe essere scaduto oppure il provider non è disponibile. Riprova.";
  if (result === "logged-out") notice = "Disconnessione completata.";
  return {
    site: tenant.site,
    local: tenant.localPreview,
    enabled,
    identity,
    notice,
  };
});

export default component$(() => {
  const data = useLogin();
  const pending = useSignal(false);
  const logoutError = useSignal("");
  const { site, local, identity, enabled, notice } = data.value;
  const brand = site.branding;
  return (
    <div
      class="restaurant staff-login"
      data-brand={brand.theme}
      style={{
        "--paper": brand.background,
        "--ink": brand.foreground,
        "--accent": brand.accent,
        "--surface": brand.surface,
      }}
    >
      <a class="skip-link" href="#contenuto">
        Vai al contenuto
      </a>
      <div class="demo-strip">Demo portfolio · Ristorante immaginario</div>
      <header class="site-header shell">
        <a class="brand-lockup" href="/">
          <img src={brand.logoPath} alt="" width="48" height="48" />
          <span>{site.name}</span>
        </a>
        <nav aria-label="Navigazione principale">
          <a href="/menu/">Menu pubblico</a>
        </nav>
      </header>
      <main class="shell login-main" id="contenuto">
        <section class="login-card" aria-labelledby="login-title">
          <p class="eyebrow">Area staff · {site.name}</p>
          <h1 id="login-title">Accesso riservato allo staff</h1>
          <p>
            Le autorizzazioni sono assegnate dal ristorante. Il menu e gli
            ordini ospite restano accessibili senza registrazione.
          </p>
          {notice && (
            <p class="login-notice" role="status">
              {notice}
            </p>
          )}
          {identity ? (
            <>
              <h2>Sessione attiva</h2>
              <p>
                {identity.identity.label} · {identity.tenant.name}
              </p>
              <p>
                Ruolo: <strong>{identity.role}</strong>
              </p>
              <p>Autorizzazioni: lettura e gestione ordini del ristorante.</p>
              <p>
                Scadenza sessione:{" "}
                <time dateTime={identity.expiresAt}>
                  {new Intl.DateTimeFormat("it-IT", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: site.timezone,
                  }).format(new Date(identity.expiresAt))}
                </time>
                .
              </p>
              {logoutError.value && <p role="alert">{logoutError.value}</p>}
              <button
                class="button"
                type="button"
                disabled={pending.value}
                onClick$={async () => {
                  pending.value = true;
                  logoutError.value = "";
                  try {
                    const response = await fetch("/api/auth/logout", {
                      method: "POST",
                      credentials: "same-origin",
                      headers: { Accept: "application/json" },
                    });
                    if (response.status !== 200) throw new Error();
                    window.location.assign("/login/?result=logged-out");
                  } catch {
                    logoutError.value = "Disconnessione non riuscita. Riprova.";
                    pending.value = false;
                  }
                }}
              >
                Esci
              </button>
            </>
          ) : enabled ? (
            <a class="button" href="/api/auth/login">
              Accedi con il provider
            </a>
          ) : (
            <p class="login-notice">
              Il login staff è temporaneamente indisponibile: il provider di
              identità non è configurato.
            </p>
          )}
          {local && (
            <p class="login-local">
              Anteprima HTTP locale: cookie dedicati a questo host. Nessun
              account demo viene autenticato automaticamente.
            </p>
          )}
        </section>
      </main>
      <footer class="site-footer shell">
        <p>
          Powered by <strong>Tavolyn</strong> · Demo portfolio
        </p>
      </footer>
    </div>
  );
});
export const head: DocumentHead = ({ resolveValue }) => ({
  title: `Accesso staff · ${resolveValue(useLogin).site.name}`,
  meta: [
    { name: "robots", content: "noindex, nofollow, noarchive" },
    { name: "referrer", content: "no-referrer" },
  ],
  links: [
    {
      rel: "icon",
      href: resolveValue(useLogin).site.branding.logoPath,
      type: "image/svg+xml",
    },
  ],
});
