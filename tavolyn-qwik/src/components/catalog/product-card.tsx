import { component$, useSignal, useStore } from "@builder.io/qwik";
import { useCart } from "../cart/cart-context";
import {
  configurationError,
  configuredPrice,
  formatMoney,
  type MenuProduct,
} from "../../lib/shared/catalog";
import { itemKey } from "../../lib/shared/cart";

export const ProductCard = component$<{
  product: MenuProduct;
  currency: string;
  index: number;
}>(({ product, currency, index }) => {
  const cart = useCart();
  const selected = useStore<Record<string, boolean>>({});
  const feedback = useSignal("");
  const modifierIds = Object.keys(selected)
    .filter((id) => selected[id])
    .sort();
  const problem = configurationError(product, modifierIds);
  return (
    <article
      class={`product-card ${!product.available ? "sold-out" : ""}`}
      data-product={product.slug}
    >
      <div class="product-heading">
        <span class="dish-number" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span class="availability">
          {product.available ? "Dal nostro menu" : "Esaurito per oggi"}
        </span>
      </div>
      <h3>{product.name}</h3>
      <p class="product-description">{product.description}</p>
      <div class="product-price">
        <strong>{formatMoney(product.basePriceCents, currency)}</strong>
        {product.modifierGroups.length > 0 && <span>prezzo base</span>}
      </div>
      {product.available ? (
        <details
          class="product-config"
          onToggle$={() => {
            feedback.value = "";
          }}
        >
          <summary>
            {product.modifierGroups.length
              ? "Personalizza e aggiungi"
              : "Aggiungi al carrello"}
            <span aria-hidden="true">＋</span>
          </summary>
          <form
            preventdefault:submit
            onSubmit$={() => {
              const ids = Object.keys(selected)
                .filter((id) => selected[id])
                .sort();
              const error = configurationError(product, ids);
              if (!cart.ready || error) {
                feedback.value = error || "Il carrello si sta caricando.";
                return;
              }
              const item = {
                productId: product.id,
                modifierIds: ids,
                quantity: 1,
              };
              const existing = cart.items.find(
                (entry) => itemKey(entry) === itemKey(item),
              );
              if (existing && existing.quantity >= 99) {
                feedback.value =
                  "Hai raggiunto il limite di 99 per questo articolo.";
                return;
              }
              if (!existing && cart.items.length >= 50) {
                feedback.value =
                  "Il carrello può contenere al massimo 50 configurazioni.";
                return;
              }
              if (existing) existing.quantity += 1;
              else cart.items.push(item);
              feedback.value = `${product.name} aggiunto al carrello.`;
            }}
          >
            {product.modifierGroups.map((group) => {
              const count = group.modifiers.filter(
                (mod) => selected[mod.id],
              ).length;
              return (
                <fieldset key={group.id}>
                  <legend>{group.title}</legend>
                  <p class="selection-hint">
                    {group.minSelect > 0 ? "Obbligatorio" : "Facoltativo"} ·{" "}
                    {group.minSelect === group.maxSelect
                      ? `scegli ${group.maxSelect}`
                      : `da ${group.minSelect} a ${group.maxSelect} scelte`}
                  </p>
                  {group.modifiers.map((mod) => (
                    <label key={mod.id} class="modifier-option">
                      <input
                        type="checkbox"
                        checked={!!selected[mod.id]}
                        disabled={
                          !mod.available ||
                          (!selected[mod.id] && count >= group.maxSelect)
                        }
                        onChange$={(_, input) => {
                          selected[mod.id] = input.checked;
                          feedback.value = "";
                        }}
                      />
                      <span>
                        {mod.label}
                        {!mod.available && <small> · non disponibile</small>}
                      </span>
                      <span>
                        {mod.deltaPriceCents
                          ? `+ ${formatMoney(mod.deltaPriceCents, currency)}`
                          : "Incluso"}
                      </span>
                    </label>
                  ))}
                </fieldset>
              );
            })}
            {problem && <p class="selection-hint">{problem}</p>}
            <button
              class="button button-primary"
              type="submit"
              disabled={!cart.ready || !!problem}
            >
              Aggiungi ·{" "}
              {formatMoney(configuredPrice(product, modifierIds), currency)}
            </button>
            <p class="product-feedback" role="status">
              {feedback.value}
            </p>
          </form>
        </details>
      ) : (
        <div class="unavailable-label">Ci ritroviamo presto</div>
      )}
    </article>
  );
});
