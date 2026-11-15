-- Fictional catalog fixtures. Deterministic UUIDs; repeat without overwriting manual edits.
-- Only the two known tenants marked is_demo = 1 receive catalog rows.
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, '96467f18-7166-461e-a5f7-9d1b5c047bef', 'Antipasti', 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'd6bd5250-e0d4-40c1-a0eb-fa456ad89b67', '96467f18-7166-461e-a5f7-9d1b5c047bef', 'crostini-dell-orto', 'Crostini dell’orto', 'Pane rustico tostato, crema di cannellini e verdure di stagione.', 650, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '193511f5-402b-4760-a357-8bc93d439f1f', '96467f18-7166-461e-a5f7-9d1b5c047bef', 'burrata-e-pomodori', 'Burrata e pomodori', 'Burrata cremosa, pomodori marinati e basilico fresco.', 850, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '67e669ef-77e4-4f0d-a25a-a41f15676ad0', '96467f18-7166-461e-a5f7-9d1b5c047bef', 'tagliere-della-casa', 'Tagliere della casa', 'Una selezione immaginata di salumi, pecorino e giardiniera.', 1200, 1, 2 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, '0949b034-6a5d-4533-a7f2-801de803b7fd', 'Pizze dal forno', 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'fea42819-fb73-4f12-aaca-e6b89ee22402', '0949b034-6a5d-4533-a7f2-801de803b7fd', 'margherita', 'Margherita', 'Pomodoro, fiordilatte, basilico e olio extravergine. La nostra semplicità.', 800, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '95f38a00-755a-4266-a1b4-81ef0d7831fc', 'fea42819-fb73-4f12-aaca-e6b89ee22402', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'bea4dbdb-92a7-4c95-a27c-dba51e9ff7eb', '95f38a00-755a-4266-a1b4-81ef0d7831fc', 'Classico', 0, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '60c765fd-f800-4af9-a2ee-d9f6ed227f73', '95f38a00-755a-4266-a1b4-81ef0d7831fc', 'Integrale', 150, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '0826e0af-6ce6-47b5-a067-9ed03955d922', 'fea42819-fb73-4f12-aaca-e6b89ee22402', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '1b241d8f-4042-42fa-a479-c64ba8afd872', '0826e0af-6ce6-47b5-a067-9ed03955d922', 'Burrata', 250, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '6f6d1c0b-3aec-40e2-aadc-696b7668386f', '0826e0af-6ce6-47b5-a067-9ed03955d922', 'Olive', 100, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '825fa73e-e681-41a7-aad8-97397d282f10', '0826e0af-6ce6-47b5-a067-9ed03955d922', 'Funghi', 150, 1, 2 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '6a299919-e7bf-4d00-a173-c04937a5dad3', '0826e0af-6ce6-47b5-a067-9ed03955d922', 'Carciofi', 200, 0, 3 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '681acecf-e0e9-4d39-aeac-c536831bf50e', '0949b034-6a5d-4533-a7f2-801de803b7fd', 'diavola', 'Diavola', 'Pomodoro, fiordilatte e salame piccante, con il calore giusto.', 1000, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '9ae871eb-14fa-4bff-a1a1-479958a101e3', '681acecf-e0e9-4d39-aeac-c536831bf50e', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '30a29087-5ecb-46fe-ab1d-147a00a8b572', '9ae871eb-14fa-4bff-a1a1-479958a101e3', 'Classico', 0, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '8a4c7d93-41b3-4e83-a877-24b04f92f98f', '9ae871eb-14fa-4bff-a1a1-479958a101e3', 'Integrale', 150, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '49ef462e-0e90-478f-a528-adf3e3c7c4ec', '681acecf-e0e9-4d39-aeac-c536831bf50e', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '2df3da3a-e46e-4fbb-af60-ee7070a785e1', '49ef462e-0e90-478f-a528-adf3e3c7c4ec', 'Burrata', 250, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '62752562-7fb1-4f56-a67f-3a6481edc0eb', '49ef462e-0e90-478f-a528-adf3e3c7c4ec', 'Olive', 100, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '83e964bd-81bf-476e-a7f1-09dff6eff0aa', '49ef462e-0e90-478f-a528-adf3e3c7c4ec', 'Funghi', 150, 1, 2 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'f2256f46-cc4a-4a45-a6c2-9846d83692d8', '49ef462e-0e90-478f-a528-adf3e3c7c4ec', 'Carciofi', 200, 0, 3 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '0dff1dd9-9948-41f6-abf4-73978681fe5d', '0949b034-6a5d-4533-a7f2-801de803b7fd', 'ortolana', 'Ortolana', 'Fiordilatte, zucchine, melanzane al forno e peperoni arrostiti.', 1050, 1, 2 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '4cb317b2-5421-476f-aa25-a8152749995c', '0dff1dd9-9948-41f6-abf4-73978681fe5d', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '42047fc2-79e0-48ac-a8d3-13e12e6c2751', '4cb317b2-5421-476f-aa25-a8152749995c', 'Classico', 0, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'c634bd21-13f5-42c9-ae7c-c3ff7515af3e', '4cb317b2-5421-476f-aa25-a8152749995c', 'Integrale', 150, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '77a70ffb-9972-4fd5-a729-bf6347bef346', '0dff1dd9-9948-41f6-abf4-73978681fe5d', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '093c4de5-e69c-4069-acc4-b228fbc34e1a', '77a70ffb-9972-4fd5-a729-bf6347bef346', 'Burrata', 250, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'f10ca12a-a7f5-4beb-a409-163fbd4a9fb4', '77a70ffb-9972-4fd5-a729-bf6347bef346', 'Olive', 100, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'df8932de-1af9-4e46-a065-c450850bf1c5', '77a70ffb-9972-4fd5-a729-bf6347bef346', 'Funghi', 150, 1, 2 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '7d195d97-da6e-439c-ad12-eb308c60bb24', '77a70ffb-9972-4fd5-a729-bf6347bef346', 'Carciofi', 200, 0, 3 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'c5feea01-66e1-4f6b-ab64-af893806ca1f', '0949b034-6a5d-4533-a7f2-801de803b7fd', 'porcini-e-taleggio', 'Porcini e taleggio', 'Profumo di bosco, taleggio fondente e prezzemolo fresco.', 1250, 0, 3 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, '9d92d341-8721-4ec6-acf5-6e6c57867b83', 'Primi di casa', 2 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '1bfd96a6-6ad3-4a91-aca4-cef7aea173a2', '9d92d341-8721-4ec6-acf5-6e6c57867b83', 'pasta-al-ragu', 'Pasta al ragù', 'Ragù della domenica cotto lentamente e Parmigiano a scaglie.', 1150, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '253d30bf-b07c-49c2-a99a-5812f9b95660', '1bfd96a6-6ad3-4a91-aca4-cef7aea173a2', 'Il formato', 1, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '9753bfeb-8ebb-4a9d-ae7d-fd94a14be9d9', '253d30bf-b07c-49c2-a99a-5812f9b95660', 'Tagliatelle', 0, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '32de5990-7da6-4563-a08e-231bb642b6ec', '253d30bf-b07c-49c2-a99a-5812f9b95660', 'Rigatoni', 0, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'f1b2c490-0c62-43d5-ac3c-a424f6da8780', '9d92d341-8721-4ec6-acf5-6e6c57867b83', 'risotto-dell-orto', 'Risotto dell’orto', 'Riso mantecato, verdure di stagione e una nota di limone.', 1200, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '746e06e9-ffdb-480a-a4eb-7985339da1e6', '9d92d341-8721-4ec6-acf5-6e6c57867b83', 'gnocchi-al-pomodoro', 'Gnocchi al pomodoro', 'Gnocchi morbidi, salsa di pomodoro e basilico profumato.', 1000, 1, 2 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, '180a591c-f174-4c1f-a668-6434783daad8', 'Dolci', 3 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '350503e3-8904-4d2c-a9fb-94a7149f6149', '180a591c-f174-4c1f-a668-6434783daad8', 'tiramisu', 'Tiramisù', 'Crema al mascarpone, caffè e cacao. Un cucchiaio di casa.', 550, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'c74d3062-6083-45e2-a569-cf7a421db92f', '180a591c-f174-4c1f-a668-6434783daad8', 'crostata-del-giorno', 'Crostata del giorno', 'Frolla al burro e confettura di albicocche.', 500, 0, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, 'edada939-d56f-4e80-af58-942bb280526a', 'Da bere', 4 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'cdcb7ddb-99b2-4ecc-add9-067f0a15f495', 'edada939-d56f-4e80-af58-942bb280526a', 'acqua-naturale', 'Acqua naturale', 'Bottiglia da 50 cl, per accompagnare la tavola.', 200, 1, 0 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '34f89042-c85c-461f-ad06-5df6d8bc5538', 'edada939-d56f-4e80-af58-942bb280526a', 'aranciata-artigianale', 'Aranciata artigianale', 'Agrumi, bollicine e una piacevole nota amara. 27,5 cl.', 350, 1, 1 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'f4cfa5f5-0a9a-4d55-a2e8-357e8e222edc', 'edada939-d56f-4e80-af58-942bb280526a', 'birra-chiara', 'Birra chiara', 'Bionda delicata, con note di pane e cereali. 33 cl.', 500, 1, 2 FROM tenants WHERE id = 'bbf324b9-0aab-4e61-9001-4ed11d0e05b1' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, 'bc4bec13-c5e5-439a-ae50-83dc51557760', 'Classici, riletti', 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '9bdedb21-b00b-47d0-a6e7-b4bf2d1174e0', 'bc4bec13-c5e5-439a-ae50-83dc51557760', 'margherita-lab', 'Margherita Lab', 'Pomodoro datterino, fiordilatte, basilico e olio al basilico.', 950, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, 'd36dde13-b1a9-4334-a593-015537ef95bb', '9bdedb21-b00b-47d0-a6e7-b4bf2d1174e0', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '9bb5494c-5630-437e-ac16-9b40c7883338', 'd36dde13-b1a9-4334-a593-015537ef95bb', 'Impasto Lab', 0, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '4715e1c6-f2ea-490e-a926-ea49088c001a', 'd36dde13-b1a9-4334-a593-015537ef95bb', 'Multicereali', 200, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '650ba959-1bdb-409b-a098-ac5e79b0b464', '9bdedb21-b00b-47d0-a6e7-b4bf2d1174e0', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '9791e9d4-12f4-44e9-a5cf-a768fb7c463e', '650ba959-1bdb-409b-a098-ac5e79b0b464', 'Stracciatella', 300, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'e2e6309e-c954-4c46-a06a-823dccff5b18', '650ba959-1bdb-409b-a098-ac5e79b0b464', 'Cipolla croccante', 150, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'e37795de-1681-4016-addb-9c14e551ec36', '650ba959-1bdb-409b-a098-ac5e79b0b464', 'Olio piccante', 50, 1, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '757b4cb0-713d-4161-ae80-baf690103d4d', '650ba959-1bdb-409b-a098-ac5e79b0b464', 'Tartufo', 400, 0, 3 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '597577fc-3cb3-49a8-aae1-20387bd7509a', 'bc4bec13-c5e5-439a-ae50-83dc51557760', 'marinara-2-0', 'Marinara 2.0', 'Tre pomodori, aglio confit, origano e olio extravergine.', 850, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '2d3422c2-560a-47ce-aaae-f88c6df70ab6', '597577fc-3cb3-49a8-aae1-20387bd7509a', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '757f2abf-9afb-4891-ad11-3e71bfd73c65', '2d3422c2-560a-47ce-aaae-f88c6df70ab6', 'Impasto Lab', 0, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'c8029b3f-8787-4845-a81f-ef575bf442a7', '2d3422c2-560a-47ce-aaae-f88c6df70ab6', 'Multicereali', 200, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '5fc45f8e-ef4a-4e2c-a4e5-75d72420128a', '597577fc-3cb3-49a8-aae1-20387bd7509a', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'ceaaec33-40d5-4b17-a67b-abc094290147', '5fc45f8e-ef4a-4e2c-a4e5-75d72420128a', 'Stracciatella', 300, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '2c406cbf-d197-4a6f-ab69-4f8cb63b707a', '5fc45f8e-ef4a-4e2c-a4e5-75d72420128a', 'Cipolla croccante', 150, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'd7867614-d610-4142-ad1b-24a6a48ad723', '5fc45f8e-ef4a-4e2c-a4e5-75d72420128a', 'Olio piccante', 50, 1, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '5e79d933-5b1b-467f-aea2-f381358f2035', '5fc45f8e-ef4a-4e2c-a4e5-75d72420128a', 'Tartufo', 400, 0, 3 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'a676704d-1c02-43bc-af7f-3b250a54d4c6', 'bc4bec13-c5e5-439a-ae50-83dc51557760', 'diavola-elettrica', 'Diavola elettrica', 'Fiordilatte, spianata piccante, miele al peperoncino e limone.', 1200, 1, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, 'aeb5ec62-158b-4be0-ae41-2291e7fe98d8', 'a676704d-1c02-43bc-af7f-3b250a54d4c6', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '5e58a137-eb5e-401c-a60d-9a859526f67d', 'aeb5ec62-158b-4be0-ae41-2291e7fe98d8', 'Impasto Lab', 0, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '80cf0398-7364-4b94-a396-b11325979720', 'aeb5ec62-158b-4be0-ae41-2291e7fe98d8', 'Multicereali', 200, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '4c19c481-9e9c-4ae1-aab7-b39bdfab3ea0', 'a676704d-1c02-43bc-af7f-3b250a54d4c6', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '82ff3356-3db5-49e5-a532-d71e304adaa1', '4c19c481-9e9c-4ae1-aab7-b39bdfab3ea0', 'Stracciatella', 300, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'b475e132-67dc-43c8-a99c-fdae5e4f3c88', '4c19c481-9e9c-4ae1-aab7-b39bdfab3ea0', 'Cipolla croccante', 150, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '07131ef5-f2cb-4962-a78f-02b6b1f43145', '4c19c481-9e9c-4ae1-aab7-b39bdfab3ea0', 'Olio piccante', 50, 1, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '40d1f0f5-58f3-4733-ac8f-68d5fa0384de', '4c19c481-9e9c-4ae1-aab7-b39bdfab3ea0', 'Tartufo', 400, 0, 3 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, 'c155931b-0633-4243-a553-9658e08e9f35', 'Esperimenti dal forno', 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'bf5dbc96-484b-4416-a567-7a71f7d26dcf', 'c155931b-0633-4243-a553-9658e08e9f35', 'verde-orbitale', 'Verde orbitale', 'Crema di piselli, zucchine, stracciatella e menta fresca.', 1350, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '77747ef1-523a-4e40-aac2-d84b9dbfbd8d', 'bf5dbc96-484b-4416-a567-7a71f7d26dcf', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '9a180a1e-ee2c-4584-ad34-ca89935abc48', '77747ef1-523a-4e40-aac2-d84b9dbfbd8d', 'Impasto Lab', 0, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'f95ff1f4-9d42-4e43-a3ea-0f2a3618b513', '77747ef1-523a-4e40-aac2-d84b9dbfbd8d', 'Multicereali', 200, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, 'e33507c7-0826-4f11-ae9f-52e6c63ba3ef', 'bf5dbc96-484b-4416-a567-7a71f7d26dcf', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '142eb48c-2e64-428d-a0b1-e21a883aaf79', 'e33507c7-0826-4f11-ae9f-52e6c63ba3ef', 'Stracciatella', 300, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'c7a3ac2e-1b6d-41db-a90f-6be2422d8834', 'e33507c7-0826-4f11-ae9f-52e6c63ba3ef', 'Cipolla croccante', 150, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'cce430de-7e96-49ce-a1ab-b976cd6894c3', 'e33507c7-0826-4f11-ae9f-52e6c63ba3ef', 'Olio piccante', 50, 1, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '45835dc0-3dbc-4ece-a2f3-84048f392a13', 'e33507c7-0826-4f11-ae9f-52e6c63ba3ef', 'Tartufo', 400, 0, 3 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'f0887976-9bfc-428e-a974-bad9c99bf3b8', 'c155931b-0633-4243-a553-9658e08e9f35', 'fumo-e-patate', 'Fumo e patate', 'Patate al forno, provola affumicata, rosmarino e pepe nero.', 1250, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '40f3a096-fe44-4d73-af67-f50a448bfa97', 'f0887976-9bfc-428e-a974-bad9c99bf3b8', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '5cc0beee-ad65-49c5-a740-d5e351c937b9', '40f3a096-fe44-4d73-af67-f50a448bfa97', 'Impasto Lab', 0, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '542c52bb-2570-4348-a933-3ea2db9ce287', '40f3a096-fe44-4d73-af67-f50a448bfa97', 'Multicereali', 200, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, 'e6915c35-c7c5-49c2-aa9d-3c3158d59cbc', 'f0887976-9bfc-428e-a974-bad9c99bf3b8', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '525ce725-1523-40ba-ad3b-7eb6ffd7455d', 'e6915c35-c7c5-49c2-aa9d-3c3158d59cbc', 'Stracciatella', 300, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '4e04168f-722a-46f6-a090-93d3b89af606', 'e6915c35-c7c5-49c2-aa9d-3c3158d59cbc', 'Cipolla croccante', 150, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '1054b944-9bf5-4166-afa4-cae30fbee262', 'e6915c35-c7c5-49c2-aa9d-3c3158d59cbc', 'Olio piccante', 50, 1, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '1f5b1d3e-173d-4391-a0cc-9a2c28b305f0', 'e6915c35-c7c5-49c2-aa9d-3c3158d59cbc', 'Tartufo', 400, 0, 3 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'e727659d-c2dc-488c-abc6-79f287600286', 'c155931b-0633-4243-a553-9658e08e9f35', 'umami-di-bosco', 'Umami di bosco', 'Funghi arrostiti, crema di sesamo e cipolla croccante.', 1450, 0, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, '1cb12706-3f3c-40a2-ab9f-8f1c4c77fd23', 'e727659d-c2dc-488c-abc6-79f287600286', 'Il tuo impasto', 1, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'e5fa1f6e-a58d-4af5-a49f-b64c047b6d28', '1cb12706-3f3c-40a2-ab9f-8f1c4c77fd23', 'Impasto Lab', 0, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, '846176fa-28c7-4987-a06b-af0c8052f00c', '1cb12706-3f3c-40a2-ab9f-8f1c4c77fd23', 'Multicereali', 200, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifier_groups (tenant_id, id, product_id, title, min_select, max_select, sort_order)
SELECT id, 'ed83d1e9-3e55-4bef-a0c5-21c10615bc21', 'e727659d-c2dc-488c-abc6-79f287600286', 'Un tocco in più', 0, 2, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'c4260600-34de-4d63-aad5-e69c7a39ddfe', 'ed83d1e9-3e55-4bef-a0c5-21c10615bc21', 'Stracciatella', 300, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'e434dd7b-8548-441b-ae22-c528e2ba78b2', 'ed83d1e9-3e55-4bef-a0c5-21c10615bc21', 'Cipolla croccante', 150, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'a432684f-5da1-44e9-ae3d-3fecd67534c5', 'ed83d1e9-3e55-4bef-a0c5-21c10615bc21', 'Olio piccante', 50, 1, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO modifiers (tenant_id, id, group_id, label, delta_price_cents, available, sort_order)
SELECT id, 'f61d4475-a59a-4bfa-ad7e-5952a259a87c', 'ed83d1e9-3e55-4bef-a0c5-21c10615bc21', 'Tartufo', 400, 0, 3 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, 'caf5e289-a3e9-4947-a03b-1ea36c51df73', 'Piccoli satelliti', 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'd7e11652-6867-4238-a0ad-421d400717a0', 'caf5e289-a3e9-4947-a03b-1ea36c51df73', 'patate-in-orbita', 'Patate in orbita', 'Spicchi al forno, paprika dolce e maionese al lime.', 500, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'd7188034-1edd-4124-aebd-b9f46c5d89d4', 'caf5e289-a3e9-4947-a03b-1ea36c51df73', 'crocchetta-lab', 'Crocchetta Lab', 'Riso, provola e una panatura dorata. Due pezzi.', 600, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, '2b78bdb2-1e0c-4de8-acc9-68b8e8f7c258', 'Finale dolce', 3 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '13c95988-59fe-4c78-ab41-360fc3953b06', '2b78bdb2-1e0c-4de8-acc9-68b8e8f7c258', 'nuvola-al-cacao', 'Nuvola al cacao', 'Mousse al cioccolato, crumble salato e olio extravergine.', 650, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO categories (tenant_id, id, name, sort_order)
SELECT id, 'd87b7bb2-ee48-4ffc-afb9-6b7c4d16d452', 'Connessioni liquide', 4 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'fec16a82-1700-4891-ac74-065f096ccfab', 'd87b7bb2-ee48-4ffc-afb9-6b7c4d16d452', 'acqua-frizzante', 'Acqua frizzante', 'Bollicine leggere. Bottiglia da 50 cl.', 250, 1, 0 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, '447e17a3-404d-4f77-af81-c6a935285bd5', 'd87b7bb2-ee48-4ffc-afb9-6b7c4d16d452', 'cola-botanica', 'Cola botanica', 'Spezie, agrumi e bollicine. Bottiglia da 33 cl.', 400, 1, 1 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
INSERT INTO products (tenant_id, id, category_id, slug, name, description, base_price_cents, available, sort_order)
SELECT id, 'f2e2d545-d2ad-48ed-a884-7bfa87768016', 'd87b7bb2-ee48-4ffc-afb9-6b7c4d16d452', 'birra-session-ipa', 'Birra Session IPA', 'Agrumi, luppolo e finale fresco. Lattina da 33 cl.', 650, 1, 2 FROM tenants WHERE id = '0fb0bff7-67e2-4848-9002-c975c0748af2' AND is_demo = 1
ON CONFLICT DO NOTHING;
