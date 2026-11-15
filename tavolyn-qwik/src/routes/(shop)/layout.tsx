import {
  component$,
  Slot,
  useContextProvider,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { isServer } from "@builder.io/qwik/build";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";
import { getRequestTenant } from "../../lib/server/tenants/tenant-service";
import { getRequestMenu } from "../../lib/server/catalog/catalog-service";
import { cartKey, restoreCart } from "../../lib/shared/cart";
import {
  CartContext,
  type CartState,
} from "../../components/cart/cart-context";

export const useShop = routeLoader$(async (event) => {
  const tenant = getRequestTenant(event);
  return {
    site: tenant.site,
    menu: await getRequestMenu(event),
    localPreview: tenant.localPreview,
  };
});

export default component$(() => {
  const shop = useShop();
  const location = useLocation();
  const cart = useStore<CartState>({ items: [], ready: false, notice: "" });
  useContextProvider(CartContext, cart);
  // Browser storage must load eagerly before cart controls become interactive.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ track }) => {
      const slug = track(() => shop.value.site.slug);
      cart.ready = false;
      try {
        const restored = restoreCart(
          localStorage.getItem(cartKey(slug)),
          shop.value.menu,
        );
        cart.items = restored.items;
        cart.notice = restored.changed
          ? "Il carrello è stato aggiornato: alcune scelte non erano più disponibili o valide."
          : "";
      } catch {
        cart.items = [];
        cart.notice =
          "La memoria del browser non è disponibile: il carrello resterà solo in questa pagina.";
      }
      cart.ready = true;
    },
    { strategy: "document-ready" },
  );

  useTask$(({ track }) => {
    const ready = track(() => cart.ready);
    const contents = track(() => JSON.stringify(cart.items));
    const slug = track(() => shop.value.site.slug);
    if (isServer || !ready) return;
    try {
      localStorage.setItem(
        cartKey(slug),
        JSON.stringify({ version: 1, items: JSON.parse(contents) }),
      );
    } catch {
      cart.notice =
        "Non è possibile salvare il carrello nel browser. Le scelte resteranno solo in questa pagina.";
    }
  });

  const { site, localPreview } = shop.value;
  const brand = site.branding;
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div
      class="restaurant shop"
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
        {localPreview && (
          <nav aria-label="Anteprima locale" class="preview-nav">
            <span>Esplora:</span>
            {["aurora", "nodo"].map((slug) => (
              <a
                key={slug}
                aria-current={site.slug === slug ? "page" : undefined}
                href={`http://${slug}.localhost${location.url.port ? `:${location.url.port}` : ""}/menu/`}
              >
                {slug === "aurora" ? "Aurora" : "Nodo"}
              </a>
            ))}
          </nav>
        )}
      </div>
      <header class="site-header shell">
        <a class="brand-lockup" href="/">
          <img src={brand.logoPath} width="52" height="52" alt="" />
          <span>{site.name}</span>
        </a>
        <nav aria-label="Navigazione principale">
          <a href="/">Il ristorante</a>
          <a
            href="/menu/"
            aria-current={
              location.url.pathname.startsWith("/menu") ? "page" : undefined
            }
          >
            Menu
          </a>
          <a
            class="cart-link"
            href="/cart/"
            aria-current={
              location.url.pathname.startsWith("/cart") ? "page" : undefined
            }
          >
            Carrello{" "}
            <span class="cart-count" aria-label={`${count} articoli`}>
              {cart.ready ? count : "…"}
            </span>
          </a>
        </nav>
      </header>
      {location.isNavigating && (
        <div class="route-loading" role="status">
          Un momento, prepariamo la pagina…
        </div>
      )}
      <main id="contenuto" class="shop-main shell">
        {cart.notice && (
          <p class="cart-notice" role="status">
            {cart.notice}
          </p>
        )}
        <Slot />
      </main>
      <footer class="site-footer shell">
        <div>
          <strong>{site.name}</strong>
          <p>
            Un’esperienza dimostrativa. Piatti e ristoranti immaginari, nessun
            ordine reale.
          </p>
        </div>
        <span class="powered-by">
          Powered by <strong>Tavolyn</strong>
        </span>
      </footer>
    </div>
  );
});
