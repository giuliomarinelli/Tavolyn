-- Local fictional OIDC subjects. No passwords, accounts or automatic login.
-- Never re-enable a disabled membership or overwrite an existing role.
INSERT INTO staff_memberships(tenant_id,cognito_sub,role,active)
SELECT id,'fixture-aurora-owner','OWNER',1 FROM tenants WHERE slug='aurora' AND is_demo=1
ON CONFLICT DO NOTHING;
INSERT INTO staff_memberships(tenant_id,cognito_sub,role,active)
SELECT id,'fixture-aurora-operator','OPERATOR',1 FROM tenants WHERE slug='aurora' AND is_demo=1
ON CONFLICT DO NOTHING;
INSERT INTO staff_memberships(tenant_id,cognito_sub,role,active)
SELECT id,'fixture-nodo-operator','OPERATOR',1 FROM tenants WHERE slug='nodo' AND is_demo=1
ON CONFLICT DO NOTHING;
INSERT INTO staff_memberships(tenant_id,cognito_sub,role,active)
SELECT id,'fixture-disabled','OPERATOR',0 FROM tenants WHERE slug='aurora' AND is_demo=1
ON CONFLICT DO NOTHING;
