import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useShop } from "../layout";
import { useCart } from "../../../components/cart/cart-context";
import { itemKey, menuProducts, validQuantity } from "../../../lib/shared/cart";
import { configuredPrice, formatMoney } from "../../../lib/shared/catalog";

export default component$(() => {
  const shop = useShop();
  const cart = useCart();
  const { menu } = shop.value;
  const products = menuProducts(menu);
  const total = cart.items.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return (
      sum +
      (product ? configuredPrice(product, item.modifierIds) * item.quantity : 0)
    );
  }, 0);
  return (
    <>
      <section class="cart-intro">
        <p class="eyebrow">Le tue scelte · {shop.value.site.name}</p>
        <h1>La tua tavola.</h1>
        <p>Un piccolo riepilogo, prima del prossimo incontro.</p>
      </section>
      {!cart.ready ? (
        <p class="empty-state" role="status">
          Recuperiamo il tuo carrello…
        </p>
      ) : cart.items.length === 0 ? (
        <section class="empty-state">
          <span class="empty-symbol" aria-hidden="true">
            ＋
          </span>
          <h2>C’è ancora posto per qualcosa di buono.</h2>
          <p>Il tuo carrello è vuoto. Il menu è un buon punto di partenza.</p>
          <a class="button button-primary" href="/menu/">
            Esplora il menu ↗
          </a>
        </section>
      ) : (
        <div class="cart-grid">
          <section class="cart-items" aria-label="Articoli nel carrello">
            {cart.items.map((item) => {
              const product = products.find(
                (entry) => entry.id === item.productId,
              );
              if (!product) return null;
              const key = itemKey(item);
              const mods = product.modifierGroups
                .flatMap((group) => group.modifiers)
                .filter((mod) => item.modifierIds.includes(mod.id));
              return (
                <article class="cart-item" key={key}>
                  <div>
                    <h2>{product.name}</h2>
                    <p>
                      {mods.map((mod) => mod.label).join(" · ") ||
                        "La ricetta originale"}
                    </p>
                    <span class="unit-price">
                      {formatMoney(
                        configuredPrice(product, item.modifierIds),
                        menu.currency,
                      )}{" "}
                      / cad.
                    </span>
                  </div>
                  <strong class="line-total">
                    {formatMoney(
                      configuredPrice(product, item.modifierIds) *
                        item.quantity,
                      menu.currency,
                    )}
                  </strong>
                  <div
                    class="quantity-controls"
                    role="group"
                    aria-label={`Quantità ${product.name}`}
                  >
                    <button
                      type="button"
                      aria-label={`Riduci ${product.name}`}
                      disabled={item.quantity <= 1}
                      onClick$={() => {
                        if (item.quantity > 1) item.quantity -= 1;
                      }}
                    >
                      −
                    </button>
                    <label class="sr-only" for={`qty-${key}`}>
                      Quantità {product.name}
                    </label>
                    <input
                      id={`qty-${key}`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="99"
                      step="1"
                      value={item.quantity}
                      onChange$={(_, input) => {
                        const quantity = Number(input.value);
                        if (validQuantity(quantity)) item.quantity = quantity;
                        else input.value = String(item.quantity);
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Aumenta ${product.name}`}
                      disabled={item.quantity >= 99}
                      onClick$={() => {
                        if (item.quantity < 99) item.quantity += 1;
                      }}
                    >
                      ＋
                    </button>
                  </div>
                  <button
                    class="remove-item"
                    type="button"
                    aria-label={`Rimuovi ${product.name}`}
                    onClick$={() => {
                      cart.items = cart.items.filter(
                        (entry) => itemKey(entry) !== key,
                      );
                    }}
                  >
                    Rimuovi
                  </button>
                </article>
              );
            })}
            <a class="text-link" href="/menu/">
              ← Continua a esplorare il menu
            </a>
          </section>
          <aside class="cart-summary" aria-labelledby="summary-title">
            <p class="eyebrow">Il riepilogo</p>
            <h2 id="summary-title">Una buona scelta.</h2>
            <div class="summary-total">
              <span>Totale indicativo</span>
              <strong data-testid="cart-total">
                {formatMoney(total, menu.currency)}
              </strong>
            </div>
            <p>
              I prezzi sono dimostrativi. Il totale definitivo verrà verificato
              dal ristorante nella futura fase di checkout.
            </p>
            <div class="checkout-note">
              <strong>Qui ci fermiamo, per ora.</strong>
              <p>
                Il checkout sarà integrato nella fase successiva della demo. Non
                è ancora possibile inviare ordini o effettuare pagamenti.
              </p>
            </div>
          </aside>
        </div>
      )}
      <noscript>
        <p>Per recuperare e modificare il carrello è necessario JavaScript.</p>
      </noscript>
    </>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const { site } = resolveValue(useShop);
  return {
    title: `Carrello · ${site.name}`,
    links: [
      { rel: "icon", type: "image/svg+xml", href: site.branding.logoPath },
    ],
  };
};
