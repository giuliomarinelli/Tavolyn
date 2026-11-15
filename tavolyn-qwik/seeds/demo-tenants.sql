-- Fictional fixtures only. Repeat runs preserve existing rows and manual edits.
-- No reset, DELETE or remote operation is performed by the local seed command.
INSERT INTO tenants (id, slug, name, branding_json, currency, timezone, contact_json, enabled, is_demo)
VALUES (
  'bbf324b9-0aab-4e61-9001-4ed11d0e05b1', 'aurora', 'Trattoria Aurora',
  '{"theme":"aurora","logoPath":"/brands/aurora.svg","background":"#f6f0e5","foreground":"#342a20","accent":"#8c3927","surface":"#e9ddc8","eyebrow":"Trattoria & forno di quartiere","headline":"Le cose buone, con il tempo giusto.","description":"Una tavola da condividere, il profumo del forno e il piacere di restare ancora un po’.","storyTitle":"Qui ci si sente a casa.","story":"Ci piacciono i gesti semplici: stendere una tovaglia, accendere il forno, fare spazio a un amico. Aurora immagina una cucina italiana che segue le stagioni e riunisce le persone.","signature":"Il calore delle cose semplici."}',
  'EUR', 'Europe/Rome',
  '{"address":"Via del Gelsomino 12 · Borgo Immaginario","email":"ciao@aurora.example.invalid","phone":"+39 000 000 0101","hours":"Martedì–domenica · 19:00–23:00","note":"Il nostro tavolo migliore è quello condiviso."}',
  1, 1
) ON CONFLICT DO NOTHING;

INSERT INTO tenants (id, slug, name, branding_json, currency, timezone, contact_json, enabled, is_demo)
VALUES (
  '0fb0bff7-67e2-4848-9002-c975c0748af2', 'nodo', 'Nodo Pizza Lab',
  '{"theme":"nodo","logoPath":"/brands/nodo.svg","background":"#172522","foreground":"#f1f2df","accent":"#cbe883","surface":"#253832","eyebrow":"Pizza. Ricerca. Convivialità.","headline":"Un punto d’incontro. Nuove possibilità.","description":"Impasti pazienti, idee in movimento. Un laboratorio di quartiere dove la pizza diventa un modo di stare insieme.","storyTitle":"Le idee migliori fanno un giro in più.","story":"Nodo nasce dall’incontro tra curiosità e materia. Immaginiamo un luogo aperto, essenziale e contemporaneo: il forno al centro, le persone tutto intorno.","signature":"Impasto. Fuoco. Idee."}',
  'EUR', 'Europe/Rome',
  '{"address":"Piazza delle Orbite 8 · Città Inventata","email":"hello@nodo.example.invalid","phone":"+39 000 000 0202","hours":"Mercoledì–lunedì · 18:30–23:30","note":"Le buone connessioni iniziano a tavola."}',
  1, 1
) ON CONFLICT DO NOTHING;

-- .test and .localhost are reserved demo names, not owned/provisioned domains.
INSERT INTO tenant_domains (hostname, tenant_id, primary_flag, local_only)
SELECT 'aurora.tavolyn.test', id, 1, 0 FROM tenants WHERE slug = 'aurora' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO tenant_domains (hostname, tenant_id, primary_flag, local_only)
SELECT 'nodo.tavolyn.test', id, 1, 0 FROM tenants WHERE slug = 'nodo' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO tenant_domains (hostname, tenant_id, primary_flag, local_only)
SELECT 'aurora.localhost', id, 0, 1 FROM tenants WHERE slug = 'aurora' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO tenant_domains (hostname, tenant_id, primary_flag, local_only)
SELECT 'nodo.localhost', id, 0, 1 FROM tenants WHERE slug = 'nodo' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO tenant_domains (hostname, tenant_id, primary_flag, local_only)
SELECT '127.0.0.1', id, 0, 1 FROM tenants WHERE slug = 'aurora' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO tenant_domains (hostname, tenant_id, primary_flag, local_only)
SELECT 'localhost', id, 0, 1 FROM tenants WHERE slug = 'aurora' AND is_demo = 1
ON CONFLICT DO NOTHING;
