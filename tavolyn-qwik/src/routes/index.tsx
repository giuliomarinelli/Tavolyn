import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <main>
      <p class="demo-label">Demo portfolio · In costruzione</p>
      <h1>Tavolyn</h1>
      <p>
        Un nuovo spazio per incontrare il tuo prossimo ristorante preferito.
      </p>
      <p>
        La base dell’applicazione è pronta. Menu, ordini e area ristorante
        arriveranno nelle prossime fasi della demo.
      </p>
      <a href="/api/health">Verifica lo stato del servizio</a>
    </main>
  );
});

export const head: DocumentHead = {
  title: "Tavolyn · Demo portfolio",
  meta: [
    {
      name: "description",
      content: "Tavolyn: demo portfolio per ristoranti, in costruzione.",
    },
  ],
};
