CREATE TABLE IF NOT EXISTS staff_memberships (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  cognito_sub TEXT NOT NULL CHECK(length(cognito_sub) BETWEEN 1 AND 255),
  role TEXT NOT NULL CHECK(role IN ('OWNER','OPERATOR')),
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  PRIMARY KEY(tenant_id,cognito_sub)
);
CREATE INDEX IF NOT EXISTS staff_subject ON staff_memberships(cognito_sub,tenant_id);
CREATE TABLE IF NOT EXISTS app_sessions (
  session_hash TEXT PRIMARY KEY CHECK(length(session_hash)=64),
  tenant_id TEXT NOT NULL,
  cognito_sub TEXT NOT NULL,
  issuer TEXT NOT NULL,
  origin TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL CHECK(expires_at > created_at),
  revoked_at TEXT,
  FOREIGN KEY(tenant_id,cognito_sub) REFERENCES staff_memberships(tenant_id,cognito_sub) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS sessions_tenant_subject ON app_sessions(tenant_id,cognito_sub,expires_at);
CREATE TABLE IF NOT EXISTS oidc_login_transactions (
  state_hash TEXT PRIMARY KEY CHECK(length(state_hash)=64),
  browser_hash TEXT NOT NULL CHECK(length(browser_hash)=64),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  origin TEXT NOT NULL,
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  encrypted_state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL CHECK(expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS login_expiry ON oidc_login_transactions(expires_at);
