CREATE TABLE IF NOT EXISTS order_events (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('ORDER_CREATED','ORDER_STATUS_CHANGED','INTERNAL_NOTE')),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('NEW','ACCEPTED','PREPARING','READY','COMPLETED','REJECTED')),
  to_status TEXT CHECK (to_status IS NULL OR to_status IN ('NEW','ACCEPTED','PREPARING','READY','COMPLETED','REJECTED')),
  visibility TEXT NOT NULL DEFAULT 'INTERNAL' CHECK (visibility IN ('PUBLIC','INTERNAL')),
  actor_subject TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,order_id) REFERENCES orders(tenant_id,id) ON DELETE RESTRICT,
  CHECK (event_type != 'ORDER_CREATED' OR (from_status IS NULL AND to_status = 'NEW' AND visibility = 'PUBLIC'))
);
CREATE UNIQUE INDEX IF NOT EXISTS order_events_created ON order_events(tenant_id,order_id) WHERE event_type = 'ORDER_CREATED';
CREATE INDEX IF NOT EXISTS order_events_timeline ON order_events(tenant_id,order_id,created_at,id);
CREATE TRIGGER IF NOT EXISTS order_events_immutable BEFORE UPDATE ON order_events BEGIN
  SELECT RAISE(ABORT, 'Order events are append-only');
END;

CREATE TABLE IF NOT EXISTS email_outbox (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type = 'ORDER_SUMMARY'),
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('LOCAL_ONLY','DISABLED_LEGACY')),
  status TEXT NOT NULL CHECK (status IN ('QUEUED','CAPTURED_LOCAL','FAILED_LOCAL','SUPPRESSED_LEGACY','SENT')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (typeof(attempts) = 'integer' AND attempts >= 0),
  restaurant_name_snapshot TEXT NOT NULL,
  timezone_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  error_code TEXT CHECK (error_code IS NULL OR error_code IN ('LOCAL_CAPTURE_FAILED','LOCAL_CAPTURE_CONFLICT','TOKEN_KEY_UNAVAILABLE')),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,order_id,message_type),
  FOREIGN KEY (tenant_id,order_id) REFERENCES orders(tenant_id,id) ON DELETE RESTRICT,
  CHECK (delivery_mode != 'DISABLED_LEGACY' OR status = 'SUPPRESSED_LEGACY'),
  CHECK (status != 'SENT') -- No live delivery exists in this milestone.
);
CREATE INDEX IF NOT EXISTS email_outbox_pending ON email_outbox(tenant_id,delivery_mode,status,created_at,id);

-- Safe to repeat. Preserve all orders, timestamps and any existing effects.
INSERT INTO order_events (tenant_id,id,order_id,event_type,from_status,to_status,visibility,actor_subject,created_at)
SELECT tenant_id,'legacy-created-' || id,id,'ORDER_CREATED',NULL,'NEW','PUBLIC',NULL,created_at
FROM orders WHERE 1
ON CONFLICT DO NOTHING;

-- Historical orders must NEVER become a live sending backlog.
INSERT INTO email_outbox (tenant_id,id,order_id,message_type,delivery_mode,status,attempts,restaurant_name_snapshot,timezone_snapshot,created_at,processed_at,error_code)
SELECT o.tenant_id,'legacy-summary-' || o.id,o.id,'ORDER_SUMMARY','DISABLED_LEGACY','SUPPRESSED_LEGACY',0,t.name,t.timezone,o.created_at,NULL,NULL
FROM orders o JOIN tenants t ON t.id = o.tenant_id WHERE 1
ON CONFLICT DO NOTHING;
