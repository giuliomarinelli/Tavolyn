export interface MenuModifier {
  id: string;
  label: string;
  deltaPriceCents: number;
  available: boolean;
}

export interface MenuModifierGroup {
  id: string;
  title: string;
  minSelect: number;
  maxSelect: number;
  modifiers: MenuModifier[];
}

export interface MenuProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePriceCents: number;
  available: boolean;
  modifierGroups: MenuModifierGroup[];
}

export interface RestaurantMenu {
  currency: string;
  categories: { id: string; name: string; products: MenuProduct[] }[];
}

export const formatMoney = (cents: number, currency = "EUR"): string =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(
    cents / 100,
  );

// Presentation validation only. TAV-MVP-04 must validate again on the server.
export const configurationError = (
  product: MenuProduct,
  modifierIds: string[],
): string | null => {
  if (!product.available) return "Questo piatto non è disponibile.";
  const allowed = product.modifierGroups.flatMap((group) => group.modifiers);
  if (
    new Set(modifierIds).size !== modifierIds.length ||
    modifierIds.some(
      (id) => !allowed.some((mod) => mod.id === id && mod.available),
    )
  )
    return "Una delle opzioni scelte non è disponibile.";
  for (const group of product.modifierGroups) {
    const count = group.modifiers.filter((mod) =>
      modifierIds.includes(mod.id),
    ).length;
    if (count < group.minSelect || count > group.maxSelect)
      return `${group.title}: scegli da ${group.minSelect} a ${group.maxSelect} opzioni.`;
  }
  return null;
};

export const configuredPrice = (
  product: MenuProduct,
  modifierIds: string[],
): number =>
  product.basePriceCents +
  product.modifierGroups
    .flatMap((group) => group.modifiers)
    .filter((mod) => modifierIds.includes(mod.id))
    .reduce((sum, mod) => sum + mod.deltaPriceCents, 0);
