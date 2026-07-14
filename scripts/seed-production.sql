-- seed-production.sql
-- Puebla la base de datos de producción con productos, categorías y formas por defecto
-- Ejecutar con: Get-Content scripts/seed-production.sql | docker exec -i barbaros-pos-db-prod psql -U barbaros -d barbaros_pos_prod

-- Categorías
INSERT INTO categories (id, name, "createdAt", "updatedAt") VALUES
  ('cat-bebidas', 'Bebidas', NOW(), NOW()),
  ('cat-cervezas', 'Cerveza', NOW(), NOW()),
  ('cat-cocteleria', 'Cocteleria', NOW(), NOW()),
  ('cat-licores', 'Licor', NOW(), NOW()),
  ('cat-snaks', 'Snak', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Productos (IDs reales de la DB de dev)
INSERT INTO products (id, name, price, "categoryId", active, "createdAt", "updatedAt") VALUES
  ('bf5c162d-1a8a-4ae3-9f87-ed24ea444744', 'Agua', 3000, 'cat-bebidas', true, NOW(), NOW()),
  ('30bfc57d-e57e-4899-af87-6c005417370a', 'Soda', 5000, 'cat-bebidas', true, NOW(), NOW()),
  ('3a48ba56-14e2-4212-b4e9-c96a6739294c', 'Gatorade', 8000, 'cat-bebidas', true, NOW(), NOW()),
  ('ac74b60f-4a6c-41e7-88ec-cccf55a1e446', 'Electrolit', 15000, 'cat-bebidas', true, NOW(), NOW()),
  ('7f797037-e5bd-416b-8dc3-a0da285640bd', 'Aguila 750 ml', 8000, 'cat-cervezas', true, NOW(), NOW()),
  ('d3282c65-f005-4066-9050-2e5e41d67c5f', 'Poker 750 ml', 8000, 'cat-cervezas', true, NOW(), NOW()),
  ('e6be2cf9-3c74-419b-9809-9211599775bc', 'Budweiser Lata', 6000, 'cat-cervezas', true, NOW(), NOW()),
  ('3a4e27ec-c82e-4e6f-aaa8-46005bdbd396', 'Corona Lata', 6000, 'cat-cervezas', true, NOW(), NOW()),
  ('26184cb4-cc94-48a4-95fe-5c9cd1afdef1', 'Michelada Aguila Ligth', 10000, 'cat-cervezas', true, NOW(), NOW()),
  ('9f8bafb6-aba2-42e9-b1f1-03a49705f715', 'Michelada Corona', 12000, 'cat-cervezas', true, NOW(), NOW()),
  ('df2bc1c3-32df-41c8-b71b-d5aa70f69ac3', 'Aguardiente Amarillo 375 ml', 60000, 'cat-licores', true, NOW(), NOW()),
  ('8642a9ef-98ce-43d9-8f9c-315419fb9095', 'Aguardiente Amarillo 750 ml', 110000, 'cat-licores', true, NOW(), NOW()),
  ('1e2c81e7-5180-4124-bd5b-1a5eba19fce5', E'Aguardiente Antioque\u00f1o 375 ml', 60000, 'cat-licores', true, NOW(), NOW()),
  ('c6dd037d-0582-441a-bfdb-5e7e0ff2d04f', E'Aguardiente Antioque\u00f1o 750 ml', 110000, 'cat-licores', true, NOW(), NOW()),
  ('4af9a346-d866-4808-88b8-752b37ff1a58', 'Ron Caldas 375 ml', 60000, 'cat-licores', true, NOW(), NOW()),
  ('a8b812ea-c844-4e89-b4e5-d88bfbbb1594', 'Ron Caldas 750 ml', 110000, 'cat-licores', true, NOW(), NOW()),
  ('5b777979-5c36-44c4-ba52-f2c0539265a0', E'Ron Caldas 5 A\u00f1os 375 ml', 70000, 'cat-licores', true, NOW(), NOW()),
  ('6558bd92-80b7-46f8-9c2c-fe16c8b412cc', E'Ron Caldas 5 A\u00f1os 750 ml', 120000, 'cat-licores', true, NOW(), NOW()),
  ('1a894d35-5b1b-4885-a481-3ce6b45818e2', 'DeTodito Rojo', 12000, 'cat-snaks', true, NOW(), NOW()),
  ('38949e8b-546e-48d2-943e-d3b973fba485', 'Trident', 3000, 'cat-snaks', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Formas del layout (plano de la discoteca) con points para LINE shapes
INSERT INTO shapes (id, type, x, y, width, height, rotation, color, "zIndex", points, "createdAt", "updatedAt") VALUES
  ('shape-rect-left', 'RECTANGLE', -525.64, 322.09, 97, 424.01, 0, '#C8A84E', 3, NULL, NOW(), NOW()),
  ('shape-rect-bar', 'RECTANGLE', -94.06, 1271.24, 600, 97.27, 0, '#C8A84E', 4, NULL, NOW(), NOW()),
  ('shape-rect-right', 'RECTANGLE', -190.17, 1270.74, 96.11, 334.55, 0, '#C8A84E', 5, NULL, NOW(), NOW()),
  ('shape-rect-left2', 'RECTANGLE', -525.89, 796.59, 97.52, 392.77, 0, '#C8A84E', 13, NULL, NOW(), NOW()),
  ('shape-line-left-top', 'LINE', 0, 0, 0, 0, 0, '#C8A84E', 1, '[{"x":-525.64,"y":322.09},{"x":-525.89,"y":141.84}]'::jsonb, NOW(), NOW()),
  ('shape-line-bottom-right', 'LINE', 0, 0, 0, 0, 0, '#C8A84E', 2, '[{"x":505.30,"y":1271.24},{"x":718.30,"y":1270.74}]'::jsonb, NOW(), NOW()),
  ('shape-line-right-full', 'LINE', 0, 0, 0, 0, 0, '#C8A84E', 6, '[{"x":718.30,"y":141.98},{"x":718.30,"y":1606.07}]'::jsonb, NOW(), NOW()),
  ('shape-line-bottom-full', 'LINE', 0, 0, 0, 0, 0, '#C8A84E', 7, '[{"x":718.30,"y":1605.41},{"x":-527.30,"y":1604.91}]'::jsonb, NOW(), NOW()),
  ('shape-line-mid-left', 'LINE', 0, 0, 0, 0, 0, '#C8A84E', 9, '[{"x":-525.64,"y":746.09},{"x":-525.64,"y":796.59}]'::jsonb, NOW(), NOW()),
  ('shape-line-top-full', 'LINE', 0, 0, 0, 0, 0, '#C8A84E', 10, '[{"x":718.70,"y":141.72},{"x":-525.64,"y":141.61}]'::jsonb, NOW(), NOW()),
  ('shape-line-mid-right', 'LINE', 0, 0, 0, 0, 0, '#C8A84E', 11, '[{"x":-526.14,"y":1188.60},{"x":-526.89,"y":1604.73}]'::jsonb, NOW(), NOW()),
  ('shape-text-lat2', 'TEXT', -602.25, 956.13, 250.25, 73.71, -89.74, '#ffffff', 8, NULL, NOW(), NOW()),
  ('shape-text-barra', 'TEXT', 124.24, 1284.52, 162.13, 69.72, 0, '#ffffff', 12, NULL, NOW(), NOW()),
  ('shape-text-lat1', 'TEXT', -606.19, 497.59, 258.12, 72.99, 269.64, '#ffffff', 14, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Labels de textos
UPDATE shapes SET label = 'LATERAL 2' WHERE id = 'shape-text-lat2';
UPDATE shapes SET label = 'BARRA' WHERE id = 'shape-text-barra';
UPDATE shapes SET label = 'LATERAL 1' WHERE id = 'shape-text-lat1';
