import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  useLocation,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { getRequestTenant } from "../../../lib/server/tenants/tenant-service";
import { readTrackedOrder } from "../../../lib/server/tracking/tracking-service";
import {
  displayTime,
  statusLabel,
  type TrackedOrder,
} from "../../../lib/shared/tracking";
import { formatMoney } from "../../../lib/shared/catalog";

export const useTrackedOrder = routeLoader$(async (event) => {
  const tenant = getRequestTenant(event);
  let order;
  try {
    order = await readTrackedOrder(
      event.platform.env.DB,
      tenant,
      event.params.trackingToken,
    );
  } catch {
    throw event.error(
      503,
      "Stato temporaneamente non disponibile. Riprova tra poco.",
    );
  }
  if (!order)
    throw event.error(
      404,
      "Ordine non disponibile. Controlla il collegamento riservato e il sito del ristorante.",
    );
  return { order, site: tenant.site };
});

export default component$(() => {
  const initial = useTrackedOrder();
  const location = useLocation();
  const order = useSignal<TrackedOrder | null>(initial.value.order);
  const loading = useSignal(false);
  const error = useSignal("");
  const refresh = useSignal(0);
  const lastChecked = useSignal("");
  const brand = initial.value.site.branding;
  // Timers and visibility listeners exist only in the browser; no duplicate initial fetch.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ track, cleanup }) => {
      const manualRefresh = track(() => refresh.value);
      let timer: ReturnType<typeof setTimeout> | undefined;
      let controller: AbortController | undefined;
      let disposed = false;
      let missing = false;
      const schedule = () => {
        if (!disposed && !missing && document.visibilityState === "visible")
          timer = setTimeout(() => {
            void load();
          }, 8000);
      };
      const load = async () => {
        if (disposed || missing || document.visibilityState !== "visible")
          return;
        clearTimeout(timer);
        controller?.abort();
        const request = new AbortController();
        controller = request;
        loading.value = true;
        try {
          const response = await fetch(
            `/api/public/orders/${encodeURIComponent(location.params.trackingToken)}`,
            {
              cache: "no-store",
              referrerPolicy: "no-referrer",
              signal: request.signal,
            },
          );
          if (disposed || request.signal.aborted) return;
          if (response.status === 404) {
            missing = true;
            order.value = null;
            error.value =
              "Ordine non disponibile. Controlla il collegamento riservato e il ristorante.";
          } else if (!response.ok)
            error.value =
              "Non riusciamo ad aggiornare lo stato. Il riepilogo precedente resta visibile; riproveremo tra poco.";
          else {
            const next = (await response.json()) as TrackedOrder;
            if (!disposed && !request.signal.aborted) {
              if (JSON.stringify(next) !== JSON.stringify(order.value))
                order.value = next;
              error.value = "";
              lastChecked.value = new Date().toISOString();
            }
          }
        } catch {
          if (!disposed && !request.signal.aborted)
            error.value =
              "Connessione interrotta. Riproveremo quando la pagina è visibile.";
        } finally {
          if (!disposed && !request.signal.aborted) {
            loading.value = false;
            schedule();
          }
        }
      };
      const visibility = () => {
        clearTimeout(timer);
        controller?.abort();
        loading.value = false;
        if (document.visibilityState === "visible") void load();
      };
      document.addEventListener("visibilitychange", visibility);
      if (manualRefresh > 0) void load();
      else schedule();
      cleanup(() => {
        disposed = true;
        clearTimeout(timer);
        controller?.abort();
        document.removeEventListener("visibilitychange", visibility);
      });
    },
    { strategy: "document-ready" },
  );

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
        <span>
          Demo portfolio · Un ordine immaginario, nessun addebito reale
        </span>
      </div>
      <header class="site-header shell">
        <a class="brand-lockup" href="/">
          <img src={brand.logoPath} width="52" height="52" alt="" />
          <span>{initial.value.site.name}</span>
        </a>
        <nav aria-label="Navigazione principale">
          <a href="/menu/">Il menu</a>
          <a href="/">Il ristorante</a>
        </nav>
      </header>
      <main id="contenuto" class="shop-main shell">
        <section class="cart-intro">
          <p class="eyebrow">La tua tavola · Collegamento riservato</p>
          <h1>Un passo alla volta.</h1>
          <p>Lo stato del tuo ordine, direttamente dal ristorante demo.</p>
        </section>
        {error.value && (
          <p class="cart-notice" role="alert">
            {error.value}
          </p>
        )}
        {order.value && (
          <>
            <section class="tracking-status" aria-labelledby="tracking-number">
              <div>
                <p class="eyebrow">Ordine demo</p>
                <h2 id="tracking-number">{order.value.orderNumber}</h2>
                <p>
                  Creato il{" "}
                  {displayTime(
                    order.value.createdAt,
                    initial.value.site.timezone,
                  )}
                </p>
              </div>
              <div>
                <span class="tracking-badge" data-testid="order-status">
                  {statusLabel[order.value.status]}
                </span>
                <p class="tracking-updated">
                  Ultimo aggiornamento:{" "}
                  <time dateTime={order.value.updatedAt}>
                    {displayTime(
                      order.value.updatedAt,
                      initial.value.site.timezone,
                    )}
                  </time>
                </p>
              </div>
            </section>
            <div class="tracking-grid">
              <section
                class="tracking-timeline"
                aria-labelledby="timeline-title"
              >
                <p class="eyebrow">Il percorso</p>
                <h2 id="timeline-title">La storia del tuo ordine.</h2>
                <ol>
                  {order.value.timeline.map((event, index) => (
                    <li key={`${event.occurredAt}-${index}`}>
                      <span class="timeline-dot" aria-hidden="true" />
                      <div>
                        <strong>{statusLabel[event.toStatus]}</strong>
                        <time dateTime={event.occurredAt}>
                          {displayTime(
                            event.occurredAt,
                            initial.value.site.timezone,
                          )}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
                <p class="checkout-disclosure">
                  Questa demo non simula avanzamenti automatici. Un nuovo ordine
                  resta ricevuto finché non verranno integrate le operazioni del
                  ristorante.
                </p>
                <button
                  class="quote-refresh"
                  type="button"
                  disabled={loading.value}
                  onClick$={() => {
                    refresh.value++;
                  }}
                >
                  Aggiorna stato
                </button>
                <p class="tracking-connection" role="status">
                  {loading.value
                    ? "Aggiornamento in corso…"
                    : lastChecked.value
                      ? "Stato verificato. Aggiornamento automatico mentre questa pagina è visibile."
                      : "Aggiornamento automatico mentre questa pagina è visibile."}
                </p>
              </section>
              <aside class="cart-summary" aria-labelledby="tracking-summary">
                <p class="eyebrow">Le tue scelte</p>
                <h2 id="tracking-summary">Il riepilogo.</h2>
                <ul class="checkout-lines">
                  {order.value.items.map((item, index) => (
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
                          order.value!.currency,
                        )}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div class="quote-fee">
                  <span>Piatti</span>
                  <span>
                    {formatMoney(
                      order.value.subtotalCents,
                      order.value.currency,
                    )}
                  </span>
                </div>
                <div class="quote-fee">
                  <span>
                    {order.value.fulfillment === "PICKUP"
                      ? "Ritiro al ristorante"
                      : "Consegna demo"}
                  </span>
                  <span>
                    {formatMoney(
                      order.value.deliveryFeeCents,
                      order.value.currency,
                    )}
                  </span>
                </div>
                <div class="summary-total">
                  <span>Totale ordine</span>
                  <strong>
                    {formatMoney(order.value.totalCents, order.value.currency)}
                  </strong>
                </div>
                <p>
                  {order.value.paymentStatus === "UNPAID"
                    ? "Contanti da pagare. Nessun pagamento anticipato."
                    : "Pagamento riuscito solo in simulazione. Nessun denaro addebitato."}
                </p>
                <p class="checkout-disclosure">
                  Il riepilogo email è predisposto per la verifica locale.
                  Nessuna email viene inviata a un destinatario reale.
                </p>
              </aside>
            </div>
          </>
        )}
        <p class="tracking-privacy">
          Questo collegamento consente di consultare l’ordine. Conservalo
          privatamente e condividilo soltanto con persone autorizzate.
        </p>
      </main>
      <footer class="site-footer shell">
        <p>Ristoranti e ordini interamente dimostrativi.</p>
        <span class="powered-by">
          Powered by <strong>Tavolyn</strong>
        </span>
      </footer>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const { site } = resolveValue(useTrackedOrder);
  return {
    title: `Stato ordine · ${site.name}`,
    links: [
      { rel: "icon", type: "image/svg+xml", href: site.branding.logoPath },
    ],
    meta: [
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
  };
};
