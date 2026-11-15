-- Demo fees only; reruns never replace the user's existing settings.
INSERT INTO tenant_checkout_settings (tenant_id, pickup_enabled, delivery_enabled, delivery_fee_cents)
SELECT id, 1, 1, 350 FROM tenants
WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO tenant_checkout_settings (tenant_id, pickup_enabled, delivery_enabled, delivery_fee_cents)
SELECT id, 1, 1, 450 FROM tenants
WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
