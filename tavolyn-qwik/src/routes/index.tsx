import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { getRequestTenant } from "../lib/server/tenants/tenant-service";

export const useRestaurant = routeLoader$((event) => {
  const tenant = getRequestTenant(event);
  const port = event.url.port ? `:${event.url.port}` : "";
  return {
    site: tenant.site,
    previewLinks: tenant.localPreview
      ? {
          aurora: `http://aurora.localhost${port}/`,
          nodo: `http://nodo.localhost${port}/`,
        }
      : null,
  };
});

export default component$(() => {
  const restaurant = useRestaurant();
  const { site, previewLinks } = restaurant.value;
  const brand = site.branding;

  return (
    <div
      class="restaurant"
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
      <div class="demo-strip">
        <span>Demo portfolio · Un ristorante immaginario</span>
        {previewLinks && (
          <nav aria-label="Anteprima locale" class="preview-nav">
            <span>Esplora:</span>
            <a
              href={previewLinks.aurora}
              aria-current={site.slug === "aurora" ? "page" : undefined}
            >
              Aurora
            </a>
            <a
              href={previewLinks.nodo}
              aria-current={site.slug === "nodo" ? "page" : undefined}
            >
              Nodo
            </a>
          </nav>
        )}
      </div>
      <header class="site-header shell">
        <a
          class="brand-lockup"
          href="#contenuto"
          aria-label={`${site.name}, inizio pagina`}
        >
          <img src={brand.logoPath} width="52" height="52" alt="" />
          <span>{site.name}</span>
        </a>
        <nav aria-label="Navigazione principale">
          <a href="#il-luogo">Il nostro mondo</a>
          <a href="#contatti">
            Dove siamo <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <main id="contenuto">
        <section class="hero shell" aria-labelledby="restaurant-name">
          <div class="hero-copy">
            <p class="eyebrow">
              <span class="status-dot" />
              {brand.eyebrow}
            </p>
            <h1 id="restaurant-name">{site.name}</h1>
            <h2>{brand.headline}</h2>
            <p class="intro">{brand.description}</p>
            <a class="text-link" href="#il-luogo">
              Entra nel nostro mondo <span aria-hidden="true">↘</span>
            </a>
          </div>
          <div class="brand-art" aria-hidden="true">
            <span class="art-caption">{brand.signature}</span>
            <svg class="table-art" viewBox="0 0 500 500" fill="none">
              <circle
                class="outer-ring"
                cx="250"
                cy="250"
                r="208"
                stroke="currentColor"
              />
              <circle
                cx="250"
                cy="250"
                r="164"
                stroke="currentColor"
                stroke-width="2"
              />
              <circle cx="250" cy="250" r="144" stroke="currentColor" />
              {brand.theme === "aurora" ? (
                <>
                  <path
                    d="M112 263a138 138 0 0 1 276 0M112 263h276M137 294h226M162 325h176"
                    stroke="currentColor"
                    stroke-width="3"
                  />
                  <path
                    d="M250 79v27M153 113l17 21M347 113l-17 21M84 197l27 7M416 197l-27 7"
                    stroke="currentColor"
                    stroke-width="3"
                  />
                  <circle cx="250" cy="237" r="44" fill="currentColor" />
                </>
              ) : (
                <>
                  <ellipse
                    cx="250"
                    cy="250"
                    rx="72"
                    ry="177"
                    transform="rotate(42 250 250)"
                    stroke="currentColor"
                    stroke-width="3"
                  />
                  <ellipse
                    cx="250"
                    cy="250"
                    rx="72"
                    ry="177"
                    transform="rotate(-42 250 250)"
                    stroke="currentColor"
                    stroke-width="3"
                  />
                  <circle cx="250" cy="250" r="26" fill="currentColor" />
                  <circle cx="387" cy="186" r="12" fill="currentColor" />
                </>
              )}
              <path
                d="M250 12v16M250 472v16M12 250h16M472 250h16"
                stroke="currentColor"
              />
            </svg>
            <span class="art-footnote">A tavola, insieme.</span>
          </div>
        </section>

        <div class="signature-line" aria-hidden="true">
          <span>{brand.signature}</span>
          <span>Una storia da condividere</span>
          <span>{brand.signature}</span>
        </div>

        <section
          id="il-luogo"
          class="story shell"
          aria-labelledby="story-title"
        >
          <p class="eyebrow">01 / Il nostro mondo</p>
          <div>
            <h2 id="story-title">{brand.storyTitle}</h2>
            <p>{brand.story}</p>
          </div>
        </section>

        <section
          id="contatti"
          class="contact-section"
          aria-labelledby="contact-title"
        >
          <div class="shell contact-grid">
            <div>
              <p class="eyebrow">02 / Ci trovi qui</p>
              <h2 id="contact-title">
                Facciamo spazio
                <br />a un incontro.
              </h2>
              <p>{site.contact.note}</p>
            </div>
            <div class="contact-details">
              <div>
                <h3>Il luogo</h3>
                <p>{site.contact.address}</p>
              </div>
              <div>
                <h3>Gli orari immaginati</h3>
                <p>{site.contact.hours}</p>
              </div>
              <div>
                <h3>I contatti demo</h3>
                <p>
                  {site.contact.email}
                  <br />
                  {site.contact.phone}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer class="site-footer shell">
        <div>
          <strong>{site.name}</strong>
          <p>
            Luoghi, orari e contatti sono inventati. Nessuna prenotazione o
            ordinazione reale.
          </p>
        </div>
        <span class="powered-by">
          Powered by <strong>Tavolyn</strong>
        </span>
      </footer>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const { site } = resolveValue(useRestaurant);
  return {
    title: `${site.name} · Demo Tavolyn`,
    links: [
      { rel: "icon", type: "image/svg+xml", href: site.branding.logoPath },
    ],
    meta: [{ name: "description", content: site.branding.description }],
  };
};
