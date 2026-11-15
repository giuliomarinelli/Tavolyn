-- All parent references carry tenant_id: an ID alone never defines ownership.
CREATE TABLE categories (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (typeof(sort_order) = 'integer'),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX categories_order ON categories(tenant_id, active, sort_order, id);

CREATE TABLE products (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 120),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(description) <= 1200),
  image_url TEXT CHECK (image_url IS NULL OR image_url LIKE '/catalog/%'),
  base_price_cents INTEGER NOT NULL CHECK (typeof(base_price_cents) = 'integer' AND base_price_cents BETWEEN 0 AND 1000000),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (typeof(sort_order) = 'integer'),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, slug),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX products_category_order ON products(tenant_id, category_id, sort_order, id);

CREATE TABLE modifier_groups (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  min_select INTEGER NOT NULL DEFAULT 0 CHECK (typeof(min_select) = 'integer' AND min_select >= 0),
  max_select INTEGER NOT NULL CHECK (typeof(max_select) = 'integer' AND max_select BETWEEN 1 AND 20 AND max_select >= min_select),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (typeof(sort_order) = 'integer'),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX modifier_groups_product_order ON modifier_groups(tenant_id, product_id, sort_order, id);

CREATE TABLE modifiers (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  delta_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (typeof(delta_price_cents) = 'integer' AND delta_price_cents BETWEEN 0 AND 1000000),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (typeof(sort_order) = 'integer'),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, group_id) REFERENCES modifier_groups(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX modifiers_group_order ON modifiers(tenant_id, group_id, sort_order, id);
