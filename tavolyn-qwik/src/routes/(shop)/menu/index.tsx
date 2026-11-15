import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useShop } from "../layout";
import { ProductCard } from "../../../components/catalog/product-card";

export default component$(() => {
  const shop = useShop();
  const { site, menu } = shop.value;
  return (
    <>
      <section class="menu-intro">
        <div>
          <p class="eyebrow">{site.branding.eyebrow} · Il menu</p>
          <h1>
            {site.slug === "aurora" ? (
              <>
                Le cose buone,
                <br />
                <em>da scegliere.</em>
              </>
            ) : (
              <>
                Segui il gusto.
                <br />
                <em>Trova il tuo Nodo.</em>
              </>
            )}
          </h1>
          <p>
            Ingredienti, incontri e piccoli piaceri. Scegli il tuo piatto e
            rendilo un po’ più tuo.
          </p>
        </div>
        <div class="menu-stamp" aria-hidden="true">
          <img src={site.branding.logoPath} width="110" height="110" alt="" />
          <span>
            {site.slug === "aurora"
              ? "Fatto con calma."
              : "Impasto. Fuoco. Idee."}
          </span>
        </div>
      </section>
      <nav class="category-nav" aria-label="Categorie del menu">
        {menu.categories.map((category) => (
          <a key={category.id} href={`#categoria-${category.id}`}>
            {category.name}
            <span>{category.products.length}</span>
          </a>
        ))}
      </nav>
      {menu.categories.length === 0 && (
        <section class="empty-state">
          <h2>Il prossimo incontro è in preparazione.</h2>
          <p>Il menu non contiene ancora piatti. Torna a trovarci tra poco.</p>
          <a class="text-link" href="/">
            Torna al ristorante ↗
          </a>
        </section>
      )}
      {menu.categories.map((category, index) => (
        <section
          class="menu-category"
          key={category.id}
          id={`categoria-${category.id}`}
          aria-labelledby={`titolo-${category.id}`}
        >
          <div class="category-heading">
            <span class="eyebrow">
              {String(index + 1).padStart(2, "0")} / A tavola
            </span>
            <h2 id={`titolo-${category.id}`}>{category.name}</h2>
          </div>
          {category.products.length ? (
            <div class="product-grid">
              {category.products.map((product, productIndex) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={menu.currency}
                  index={productIndex}
                />
              ))}
            </div>
          ) : (
            <p class="empty-category">
              Nuove proposte in arrivo in questa categoria.
            </p>
          )}
        </section>
      ))}
      <aside class="menu-note">
        <span aria-hidden="true">✳</span>
        <p>
          Una tavola immaginaria, un’esperienza da esplorare. Prezzi
          dimostrativi in euro; nessuna ordinazione reale.
        </p>
        <a href="/cart/">Rivedi il tuo carrello ↗</a>
      </aside>
    </>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const { site } = resolveValue(useShop);
  return {
    title: `Menu · ${site.name}`,
    links: [
      { rel: "icon", type: "image/svg+xml", href: site.branding.logoPath },
    ],
    meta: [
      {
        name: "description",
        content: `Scopri il menu dimostrativo di ${site.name}: piatti, ingredienti e personalizzazioni.`,
      },
    ],
  };
};
