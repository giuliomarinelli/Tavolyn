import type { RequestEventCommon } from "@builder.io/qwik-city";
import type { RestaurantSite } from "../../shared/site";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  branding_json: string;
  contact_json: string;
}

export interface ResolvedTenant {
  id: string;
  site: RestaurantSite;
  localPreview: boolean;
}

const contextKey = "tavolyn.tenant";

const parseObject = (value: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid restaurant configuration");
  }
  return parsed as Record<string, unknown>;
};

const field = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length < 1 || value.length > 1200) {
    throw new Error("Invalid restaurant field");
  }
  return value;
};

const color = (record: Record<string, unknown>, key: string): string => {
  const value = field(record, key);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Invalid brand color");
  return value;
};

const toSite = (row: TenantRow): RestaurantSite => {
  const brand = parseObject(row.branding_json);
  const contact = parseObject(row.contact_json);
  const theme = field(brand, "theme");
  const logoPath = field(brand, "logoPath");
  if (
    (theme !== "aurora" && theme !== "nodo") ||
    !/^\/brands\/[a-z-]+\.svg$/.test(logoPath)
  ) {
    throw new Error("Invalid restaurant branding");
  }
  return {
    slug: row.slug,
    name: row.name,
    currency: row.currency,
    timezone: row.timezone,
    branding: {
      theme,
      logoPath,
      background: color(brand, "background"),
      foreground: color(brand, "foreground"),
      accent: color(brand, "accent"),
      surface: color(brand, "surface"),
      eyebrow: field(brand, "eyebrow"),
      headline: field(brand, "headline"),
      description: field(brand, "description"),
      storyTitle: field(brand, "storyTitle"),
      story: field(brand, "story"),
      signature: field(brand, "signature"),
    },
    contact: {
      address: field(contact, "address"),
      email: field(contact, "email"),
      phone: field(contact, "phone"),
      hours: field(contact, "hours"),
      note: field(contact, "note"),
    },
  };
};

export const resolveTenant = async (
  url: URL,
  env: Env,
): Promise<ResolvedTenant | null> => {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname.length > 253 || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(hostname))
    return null;
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");
  const localPreview =
    env.LOCAL_DEMO_MODE === "true" && url.protocol === "http:" && isLocalHost;
  if (isLocalHost && !localPreview) return null;

  // Authority comes exclusively from the request URL and exact D1 mapping.
  // No query/body/header values participate in this lookup.
  const row = await env.DB.prepare(
    `
    SELECT t.id, t.slug, t.name, t.currency, t.timezone, t.branding_json, t.contact_json
    FROM tenant_domains d JOIN tenants t ON t.id = d.tenant_id
    WHERE d.hostname = ? AND t.enabled = 1 AND (d.local_only = 0 OR ? = 1)
    LIMIT 1
  `,
  )
    .bind(hostname, localPreview ? 1 : 0)
    .first<TenantRow>();
  return row ? { id: row.id, site: toSite(row), localPreview } : null;
};

export const setRequestTenant = (
  event: RequestEventCommon,
  tenant: ResolvedTenant,
): void => {
  event.sharedMap.set(contextKey, tenant);
};

export const getRequestTenant = (event: RequestEventCommon): ResolvedTenant => {
  const tenant: ResolvedTenant | undefined = event.sharedMap.get(contextKey);
  if (!tenant) throw event.error(404, "Ristorante non disponibile");
  return tenant;
};
