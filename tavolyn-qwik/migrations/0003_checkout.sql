CREATE TABLE tenant_checkout_settings (
  tenant_id TEXT PRIMARY KEY NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  pickup_enabled INTEGER NOT NULL DEFAULT 1 CHECK (pickup_enabled IN (0, 1)),
  delivery_enabled INTEGER NOT NULL DEFAULT 0 CHECK (delivery_enabled IN (0, 1)),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (typeof(delivery_fee_cents) = 'integer' AND delivery_fee_cents BETWEEN 0 AND 10000)
);

CREATE TABLE orders (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACCEPTED','PREPARING','READY','COMPLETED','REJECTED')),
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('PICKUP','DELIVERY')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH','MOCK_CARD')),
  payment_status TEXT NOT NULL CHECK ((payment_method = 'CASH' AND payment_status = 'UNPAID') OR (payment_method = 'MOCK_CARD' AND payment_status = 'PAID_SIMULATED')),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  subtotal_cents INTEGER NOT NULL CHECK (typeof(subtotal_cents) = 'integer' AND subtotal_cents BETWEEN 0 AND 200000),
  delivery_fee_cents INTEGER NOT NULL CHECK (typeof(delivery_fee_cents) = 'integer' AND delivery_fee_cents BETWEEN 0 AND 10000 AND (fulfillment_type = 'DELIVERY' OR delivery_fee_cents = 0)),
  total_cents INTEGER NOT NULL CHECK (typeof(total_cents) = 'integer' AND total_cents = subtotal_cents + delivery_fee_cents AND total_cents <= 200000),
  contact_snapshot_json TEXT NOT NULL CHECK (json_valid(contact_snapshot_json)),
  address_snapshot_json TEXT CHECK (address_snapshot_json IS NULL OR json_valid(address_snapshot_json)),
  notes TEXT NOT NULL CHECK (length(notes) <= 500),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, order_number),
  CHECK ((fulfillment_type = 'PICKUP' AND address_snapshot_json IS NULL) OR (fulfillment_type = 'DELIVERY' AND address_snapshot_json IS NOT NULL))
);
CREATE INDEX orders_tenant_created ON orders(tenant_id, created_at, id);

CREATE TABLE order_items (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (typeof(qty) = 'integer' AND qty BETWEEN 1 AND 99),
  unit_price_cents INTEGER NOT NULL CHECK (typeof(unit_price_cents) = 'integer' AND unit_price_cents BETWEEN 0 AND 200000),
  modifiers_snapshot_json TEXT NOT NULL CHECK (json_valid(modifiers_snapshot_json)),
  line_total_cents INTEGER NOT NULL CHECK (typeof(line_total_cents) = 'integer' AND line_total_cents = qty * unit_price_cents AND line_total_cents <= 200000),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id) ON DELETE RESTRICT
  -- product_id is an immutable historical reference, deliberately not a live FK.
);
CREATE INDEX order_items_order ON order_items(tenant_id, order_id, id);

CREATE TABLE order_access (
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  tracking_hash TEXT NOT NULL CHECK (length(tracking_hash) = 64),
  token_nonce TEXT NOT NULL CHECK (length(token_nonce) = 64),
  key_version INTEGER NOT NULL CHECK (key_version = 1),
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, order_id),
  UNIQUE (tenant_id, tracking_hash),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE idempotency_records (
  tenant_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation = 'CREATE_ORDER'),
  key_hash TEXT NOT NULL CHECK (length(key_hash) = 64),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  order_id TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, operation, key_hash),
  UNIQUE (tenant_id, operation, order_id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id) ON DELETE RESTRICT
);

CREATE TRIGGER order_items_immutable BEFORE UPDATE ON order_items BEGIN
  SELECT RAISE(ABORT, 'Order item snapshots are immutable');
END;
CREATE TRIGGER orders_commercial_immutable BEFORE UPDATE OF
  tenant_id, id, order_number, fulfillment_type, payment_method, payment_status,
  currency, subtotal_cents, delivery_fee_cents, total_cents, contact_snapshot_json,
  address_snapshot_json, notes, created_at ON orders BEGIN
  SELECT RAISE(ABORT, 'Order commercial snapshots are immutable');
END;
