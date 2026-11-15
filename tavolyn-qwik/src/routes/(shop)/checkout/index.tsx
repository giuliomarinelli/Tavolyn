import {
  component$,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { isServer } from "@builder.io/qwik/build";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { useShop } from "../layout";
import { useCart } from "../../../components/cart/cart-context";
import { formatMoney } from "../../../lib/shared/catalog";
import type {
  ApiFailure,
  Fulfillment,
  OrderInput,
  OrderReceipt,
  OrderResponse,
  PaymentMethod,
  Quote,
} from "../../../lib/shared/checkout";
import { checkoutSettings } from "../../../lib/server/checkout/quote-service";
import { getRequestTenant } from "../../../lib/server/tenants/tenant-service";

export const useCheckoutSettings = routeLoader$(async (event) => {
  try {
    return await checkoutSettings(
      event.platform.env.DB,
      getRequestTenant(event).id,
    );
  } catch {
    throw event.error(503, "Checkout temporaneamente non disponibile");
  }
});

export default component$(() => {
  const shop = useShop();
  const settings = useCheckoutSettings();
  const cart = useCart();
  const quote = useSignal<Quote | null>(null);
  const receipt = useSignal<OrderReceipt | null>(null);
  const pending = useSignal("");
  const refresh = useSignal(0);
  const state = useStore({
    ready: false,
    quoting: false,
    busy: false,
    error: "",
    quoteError: "",
    storageWarning: "",
    name: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    postalCode: "",
    notes: "",
    fulfillment: (settings.value.pickupEnabled
      ? "PICKUP"
      : "DELIVERY") as Fulfillment,
    paymentMethod: "MOCK_CARD" as PaymentMethod,
    mockPaymentResult: "SUCCESS" as "SUCCESS" | "FAILURE",
  });
  const pendingKey = `tavolyn:checkout:pending:v1:${shop.value.site.slug}`;
  const receiptKey = `tavolyn:checkout:receipt:v1:${shop.value.site.slug}`;
  // Only explicit submissions are stored. Never store the tracking credential.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      try {
        const savedPending = sessionStorage.getItem(pendingKey);
        if (savedPending && savedPending.length <= 32768) {
          const command: unknown = JSON.parse(savedPending);
          if (
            command &&
            typeof command === "object" &&
            "idempotencyKey" in command &&
            typeof command.idempotencyKey === "string"
          )
            pending.value = savedPending;
        }
        if (!pending.value) {
          const saved = sessionStorage.getItem(receiptKey);
          if (saved && saved.length <= 32768) {
            const value = JSON.parse(saved) as Partial<OrderReceipt>;
            if (
              value &&
              typeof value.orderNumber === "string" &&
              Array.isArray(value.items) &&
              typeof value.totalCents === "number" &&
              typeof value.currency === "string"
            )
              receipt.value = value as OrderReceipt;
          }
        }
      } catch {
        state.storageWarning =
          "Recupero dopo refresh non disponibile. Resta su questa pagina fino all’esito.";
      }
      state.ready = true;
    },
    { strategy: "document-ready" },
  );

  useTask$(async ({ track, cleanup }) => {
    const ready = track(() => cart.ready && state.ready);
    const items = track(() => JSON.stringify(cart.items));
    const fulfillment = track(() => state.fulfillment);
    track(() => refresh.value);
    if (isServer || !ready) return;
    quote.value = null;
    state.quoteError = "";
    if (JSON.parse(items).length === 0 || pending.value) return;
    receipt.value = null;
    try {
      sessionStorage.removeItem(receiptKey);
    } catch {
      /* In-memory checkout remains usable. */
    }
    const controller = new AbortController();
    cleanup(() => controller.abort());
    state.quoting = true;
    try {
      const response = await fetch("/api/public/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: JSON.parse(items), fulfillment }),
        signal: controller.signal,
      });
      const body = (await response.json()) as Quote & ApiFailure;
      if (!controller.signal.aborted) {
        if (response.ok) quote.value = body;
        else
          state.quoteError =
            body.error?.message || "Preventivo non disponibile.";
      }
    } catch {
      if (!controller.signal.aborted)
        state.quoteError =
          "Connessione non disponibile. Aggiorna il preventivo per riprovare.";
    } finally {
      if (!controller.signal.aborted) state.quoting = false;
    }
  });

  return (
    <>
      <section class="cart-intro">
        <p class="eyebrow">Un ultimo passo · {shop.value.site.name}</p>
        <h1>{receipt.value ? "Ci siamo." : "A tavola, tra poco."}</h1>
        <p>
          Checkout ospite · Solo una demo, nessun addebito e nessuna carta
          richiesta.
        </p>
      </section>
      {state.storageWarning && (
        <p class="cart-notice" role="status">
          {state.storageWarning}
        </p>
      )}
      {!state.ready || !cart.ready ? (
        <p role="status">Prepariamo il checkout…</p>
      ) : receipt.value ? (
        <section class="order-confirmation" aria-labelledby="order-title">
          <p class="eyebrow">Ordine demo registrato</p>
          <h2 id="order-title">Conferma {receipt.value.orderNumber}</h2>
          <p>
            Il tuo ordine dimostrativo è stato salvato. Nessun ristorante reale
            lo preparerà.
          </p>
          <dl class="confirmation-facts">
            <div>
              <dt>Stato ordine</dt>
              <dd>Nuovo</dd>
            </div>
            <div>
              <dt>Modalità</dt>
              <dd>
                {receipt.value.fulfillment === "PICKUP"
                  ? "Ritiro al ristorante"
                  : "Consegna demo"}
              </dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>
                {receipt.value.paymentStatus === "PAID_SIMULATED"
                  ? "Riuscito in simulazione"
                  : "Contanti da pagare"}
              </dd>
            </div>
          </dl>
          <ul class="checkout-lines">
            {receipt.value.items.map((item, index) => (
              <li key={index}>
                <span>
                  {item.quantity} × {item.name}
                  <small>
                    {item.modifiers.map((mod) => mod.label).join(" · ")}
                  </small>
                </span>
                <strong>
                  {formatMoney(item.lineTotalCents, receipt.value!.currency)}
                </strong>
              </li>
            ))}
          </ul>
          <p>
            {receipt.value.fulfillment === "PICKUP" ? "Ritiro" : "Consegna"}:{" "}
            {formatMoney(
              receipt.value.deliveryFeeCents,
              receipt.value.currency,
            )}
          </p>
          <p class="confirmed-total">
            Totale confermato{" "}
            <strong>
              {formatMoney(receipt.value.totalCents, receipt.value.currency)}
            </strong>
          </p>
          <p class="checkout-disclosure">
            Nessun denaro addebitato. Nessuna email inviata. Il tracking sarà
            disponibile in una fase successiva della demo.
          </p>
          <a class="text-link" href="/menu/">
            Torna al menu ↗
          </a>
        </section>
      ) : cart.items.length === 0 && !pending.value ? (
        <section class="empty-state">
          <h2>Il tuo carrello è vuoto.</h2>
          <p>Scegli qualcosa dal menu per iniziare.</p>
          <a class="button button-primary" href="/menu/">
            Esplora il menu
          </a>
        </section>
      ) : (
        <form
          class="checkout-grid"
          aria-busy={state.busy}
          preventdefault:submit
          onSubmit$={async () => {
            if (state.busy || !state.ready) return;
            if (!pending.value && !quote.value) {
              state.error = "Attendi un preventivo valido prima di confermare.";
              return;
            }
            if (!pending.value) {
              const command: OrderInput = {
                idempotencyKey: crypto.randomUUID(),
                cart: { items: JSON.parse(JSON.stringify(cart.items)) },
                fulfillment: state.fulfillment,
                quoteFingerprint: quote.value!.quoteFingerprint,
                contact: {
                  name: state.name,
                  email: state.email,
                  phone: state.phone,
                },
                address:
                  state.fulfillment === "DELIVERY"
                    ? {
                        street: state.street,
                        city: state.city,
                        postalCode: state.postalCode,
                      }
                    : null,
                paymentMethod: state.paymentMethod,
                mockPaymentResult:
                  state.paymentMethod === "MOCK_CARD"
                    ? state.mockPaymentResult
                    : null,
                notes: state.notes,
              };
              pending.value = JSON.stringify(command);
              try {
                sessionStorage.setItem(pendingKey, pending.value);
              } catch {
                state.storageWarning =
                  "Recupero dopo refresh non disponibile. Per un errore di rete usa Riprova su questa pagina.";
              }
            }
            state.busy = true;
            state.error = "";
            try {
              const response = await fetch("/api/public/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: pending.value,
              });
              const body = (await response.json()) as OrderResponse &
                ApiFailure;
              if (!response.ok) {
                state.error =
                  body.error?.message ||
                  "Conferma non disponibile. Riprova la stessa richiesta.";
                if (
                  response.status < 500 &&
                  body.error?.code !== "IDEMPOTENCY_CONFLICT"
                ) {
                  pending.value = "";
                  try {
                    sessionStorage.removeItem(pendingKey);
                  } catch {
                    /* Safe same-page retry. */
                  }
                  refresh.value++;
                }
                return;
              }
              const confirmed: OrderReceipt = {
                orderNumber: body.orderNumber,
                status: body.status,
                paymentMethod: body.paymentMethod,
                paymentStatus: body.paymentStatus,
                createdAt: body.createdAt,
                currency: body.currency,
                fulfillment: body.fulfillment,
                items: body.items,
                subtotalCents: body.subtotalCents,
                deliveryFeeCents: body.deliveryFeeCents,
                totalCents: body.totalCents,
                quoteFingerprint: body.quoteFingerprint,
              };
              receipt.value = confirmed;
              try {
                sessionStorage.setItem(receiptKey, JSON.stringify(confirmed));
                sessionStorage.removeItem(pendingKey);
              } catch {
                state.storageWarning =
                  "Conferma ricevuta; il browser non ne consente il recupero dopo refresh.";
              }
              pending.value = "";
              cart.items = [];
            } catch {
              state.error =
                "Esito non ricevuto. Usa Riprova per la stessa richiesta, anche dopo un refresh di questa scheda.";
            } finally {
              state.busy = false;
            }
          }}
        >
          <div class="checkout-form">
            {pending.value && (
              <p class="cart-notice" role="status">
                Una richiesta è in attesa di esito. Riprova la stessa conferma:
                non verrà creato un secondo ordine.
              </p>
            )}
            <fieldset disabled={state.busy || !!pending.value}>
              <legend>01 / Come ci incontriamo</legend>
              <div class="fulfillment-options">
                <label>
                  <input
                    type="radio"
                    name="fulfillment"
                    checked={state.fulfillment === "PICKUP"}
                    disabled={!settings.value.pickupEnabled}
                    onChange$={() => {
                      state.fulfillment = "PICKUP";
                    }}
                  />{" "}
                  Ritiro · gratuito
                </label>
                <label>
                  <input
                    type="radio"
                    name="fulfillment"
                    checked={state.fulfillment === "DELIVERY"}
                    disabled={!settings.value.deliveryEnabled}
                    onChange$={() => {
                      state.fulfillment = "DELIVERY";
                    }}
                  />{" "}
                  Consegna ·{" "}
                  {formatMoney(
                    settings.value.deliveryFeeCents,
                    shop.value.site.currency,
                  )}
                </label>
              </div>
            </fieldset>
            <fieldset disabled={state.busy || !!pending.value}>
              <legend>02 / I tuoi contatti demo</legend>
              <p class="selection-hint">
                Usa dati fittizi. Non inviamo email e non effettuiamo consegne
                reali.
              </p>
              <label class="form-field">
                Nome
                <input
                  autoComplete="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={state.name}
                  onInput$={(_, input) => {
                    state.name = input.value;
                  }}
                />
              </label>
              <label class="form-field">
                Email
                <input
                  autoComplete="email"
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  value={state.email}
                  onInput$={(_, input) => {
                    state.email = input.value;
                  }}
                />
              </label>
              <label class="form-field">
                Telefono
                <input
                  autoComplete="tel"
                  type="tel"
                  name="phone"
                  required
                  minLength={5}
                  maxLength={30}
                  value={state.phone}
                  onInput$={(_, input) => {
                    state.phone = input.value;
                  }}
                />
              </label>
              {state.fulfillment === "DELIVERY" && (
                <div class="delivery-address">
                  <h2>Indirizzo di consegna demo</h2>
                  <label class="form-field">
                    Via e numero
                    <input
                      name="street"
                      autoComplete="street-address"
                      required
                      minLength={5}
                      maxLength={200}
                      value={state.street}
                      onInput$={(_, input) => {
                        state.street = input.value;
                      }}
                    />
                  </label>
                  <label class="form-field">
                    Città
                    <input
                      name="city"
                      autoComplete="address-level2"
                      required
                      minLength={2}
                      maxLength={100}
                      value={state.city}
                      onInput$={(_, input) => {
                        state.city = input.value;
                      }}
                    />
                  </label>
                  <label class="form-field">
                    CAP
                    <input
                      name="postalCode"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      pattern="[0-9]{5}"
                      required
                      maxLength={5}
                      value={state.postalCode}
                      onInput$={(_, input) => {
                        state.postalCode = input.value;
                      }}
                    />
                  </label>
                </div>
              )}
            </fieldset>
            <fieldset disabled={state.busy || !!pending.value}>
              <legend>03 / Pagamento dimostrativo</legend>
              <div class="fulfillment-options">
                <label>
                  <input
                    type="radio"
                    name="payment"
                    checked={state.paymentMethod === "MOCK_CARD"}
                    onChange$={() => {
                      state.paymentMethod = "MOCK_CARD";
                    }}
                  />{" "}
                  Carta simulata
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment"
                    checked={state.paymentMethod === "CASH"}
                    onChange$={() => {
                      state.paymentMethod = "CASH";
                    }}
                  />{" "}
                  Contanti{" "}
                  {state.fulfillment === "PICKUP"
                    ? "al ritiro"
                    : "alla consegna"}
                </label>
              </div>
              {state.paymentMethod === "MOCK_CARD" ? (
                <label class="form-field">
                  Esito della simulazione
                  <select
                    name="mockPaymentResult"
                    value={state.mockPaymentResult}
                    onChange$={(_, select) => {
                      state.mockPaymentResult =
                        select.value === "FAILURE" ? "FAILURE" : "SUCCESS";
                    }}
                  >
                    <option value="SUCCESS">Successo simulato</option>
                    <option value="FAILURE">Fallimento simulato</option>
                  </select>
                </label>
              ) : (
                <p class="checkout-disclosure">
                  Nessun anticipo. L’ordine sarà registrato come non pagato.
                </p>
              )}
              <p class="checkout-disclosure">
                Non inserire numeri di carta o dati bancari. Nessun pagamento
                reale, in qualsiasi modalità.
              </p>
              <label class="form-field">
                Note (facoltative, massimo 500 caratteri)
                <textarea
                  name="notes"
                  maxLength={500}
                  rows={3}
                  value={state.notes}
                  onInput$={(_, input) => {
                    state.notes = input.value;
                  }}
                />
              </label>
            </fieldset>
          </div>
          <aside
            class="cart-summary checkout-summary"
            aria-labelledby="quote-title"
          >
            <p class="eyebrow">Il tuo ordine demo</p>
            <h2 id="quote-title">Tutto al suo posto.</h2>
            {state.quoting && (
              <p role="status">Calcoliamo il preventivo sul menu aggiornato…</p>
            )}
            {state.quoteError && (
              <p class="form-error" role="alert">
                {state.quoteError}
              </p>
            )}
            {quote.value && (
              <>
                <ul class="checkout-lines">
                  {quote.value.items.map((item, index) => (
                    <li key={index}>
                      <span>
                        {item.quantity} × {item.name}
                        <small>
                          {item.modifiers.map((mod) => mod.label).join(" · ")}
                        </small>
                      </span>
                      <strong>
                        {formatMoney(
                          item.lineTotalCents,
                          quote.value!.currency,
                        )}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div class="quote-fee">
                  <span>Piatti</span>
                  <span>
                    {formatMoney(
                      quote.value.subtotalCents,
                      quote.value.currency,
                    )}
                  </span>
                </div>
                <div class="quote-fee">
                  <span>
                    {quote.value.fulfillment === "PICKUP"
                      ? "Ritiro"
                      : "Consegna"}
                  </span>
                  <span>
                    {formatMoney(
                      quote.value.deliveryFeeCents,
                      quote.value.currency,
                    )}
                  </span>
                </div>
                <div class="summary-total">
                  <span>Totale verificato</span>
                  <strong data-testid="quote-total">
                    {formatMoney(quote.value.totalCents, quote.value.currency)}
                  </strong>
                </div>
              </>
            )}
            {!pending.value && (
              <button
                class="quote-refresh"
                type="button"
                disabled={state.busy || state.quoting}
                onClick$={() => {
                  refresh.value++;
                }}
              >
                Aggiorna preventivo
              </button>
            )}
            {state.error && (
              <p class="form-error" role="alert">
                {state.error}
              </p>
            )}
            <button
              class="button button-primary"
              type="submit"
              disabled={state.busy || (!quote.value && !pending.value)}
            >
              {state.busy
                ? "Conferma in corso…"
                : pending.value
                  ? "Riprova la stessa conferma"
                  : "Conferma ordine demo"}
            </button>
            <p class="selection-hint">
              Ordine dimostrativo, senza addebiti. I prezzi vengono verificati
              nuovamente alla conferma.
            </p>
            <a href="/cart/">Rivedi il carrello</a>
          </aside>
        </form>
      )}
    </>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const { site } = resolveValue(useShop);
  return {
    title: `Checkout · ${site.name}`,
    links: [
      { rel: "icon", type: "image/svg+xml", href: site.branding.logoPath },
    ],
    meta: [{ name: "referrer", content: "no-referrer" }],
  };
};
