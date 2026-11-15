CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 60),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  branding_json TEXT NOT NULL CHECK (json_valid(branding_json)),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  timezone TEXT NOT NULL,
  contact_json TEXT NOT NULL CHECK (json_valid(contact_json)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  hostname TEXT PRIMARY KEY NOT NULL
    CHECK (hostname = lower(hostname) AND length(hostname) BETWEEN 1 AND 253
      AND hostname NOT LIKE '%/%' AND hostname NOT LIKE '%:%'
      AND hostname NOT LIKE '%.') ,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  primary_flag INTEGER NOT NULL DEFAULT 0 CHECK (primary_flag IN (0, 1)),
  local_only INTEGER NOT NULL DEFAULT 0 CHECK (local_only IN (0, 1))
);

CREATE INDEX IF NOT EXISTS tenant_domains_tenant_id ON tenant_domains(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_primary
  ON tenant_domains(tenant_id) WHERE primary_flag = 1;
