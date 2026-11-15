export interface RestaurantBrand {
  theme: "aurora" | "nodo";
  logoPath: string;
  background: string;
  foreground: string;
  accent: string;
  surface: string;
  eyebrow: string;
  headline: string;
  description: string;
  storyTitle: string;
  story: string;
  signature: string;
}

export interface RestaurantContact {
  address: string;
  email: string;
  phone: string;
  hours: string;
  note: string;
}

// Only public presentation fields. No database ID or domain/membership records.
export interface RestaurantSite {
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  branding: RestaurantBrand;
  contact: RestaurantContact;
}
