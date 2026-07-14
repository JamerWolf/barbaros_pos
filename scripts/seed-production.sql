-- seed-production.sql
-- Puebla la base de datos de producción con productos, categorías y formas por defecto
-- Ejecutar con: psql -U barbaros -d barbaros_pos_prod -f seed-production.sql

-- Categorías
INSERT INTO categories (id, name, "createdAt", "updatedAt") VALUES
  ('cat-bebidas', 'Bebidas', NOW(), NOW()),
  ('cat-cervezas', 'Cerveza', NOW(), NOW()),
  ('cat-cocteleria', 'Cocteleria', NOW(), NOW()),
  ('cat-licores', 'Licor', NOW(), NOW()),
  ('cat-snaks', 'Snak', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Productos
INSERT INTO products (id, name, price, "categoryId", active, "createdAt", "updatedAt") VALUES
  ('prod-agua', 'Agua', 3000, 'cat-bebidas', true, NOW(), NOW()),
  ('prod-soda', 'Soda', 5000, 'cat-bebidas', true, NOW(), NOW()),
  ('prod-gatorade', 'Gatorade', 8000, 'cat-bebidas', true, NOW(), NOW()),
  ('prod-electrolit', 'Electrolit', 15000, 'cat-bebidas', true, NOW(), NOW()),
  ('prod-aguila750', 'Aguila 750 ml', 8000, 'cat-cervezas', true, NOW(), NOW()),
  ('prod-poker750', 'Poker 750 ml', 8000, 'cat-cervezas', true, NOW(), NOW()),
  ('prod-budweiser', 'Budweiser Lata', 6000, 'cat-cervezas', true, NOW(), NOW()),
  ('prod-corona', 'Corona Lata', 6000, 'cat-cervezas', true, NOW(), NOW()),
  ('prod-michelada-aguila', 'Michelada Aguila Ligth', 10000, 'cat-cervezas', true, NOW(), NOW()),
  ('prod-michelada-corona', 'Michelada Corona', 12000, 'cat-cervezas', true, NOW(), NOW()),
  ('prod-aguardiente-amarillo-375', 'Aguardiente Amarillo 375 ml', 60000, 'cat-licores', true, NOW(), NOW()),
  ('prod-aguardiente-amarillo-750', 'Aguardiente Amarillo 750 ml', 110000, 'cat-licores', true, NOW(), NOW()),
  ('prod-aguardiente-antioqueno-375', 'Aguardiente Antioqueño 375 ml', 60000, 'cat-licores', true, NOW(), NOW()),
  ('prod-aguardiente-antioqueno-750', 'Aguardiente Antioqueño 750 ml', 110000, 'cat-licores', true, NOW(), NOW()),
  ('prod-ron-caldas-375', 'Ron Caldas 375 ml', 60000, 'cat-licores', true, NOW(), NOW()),
  ('prod-ron-caldas-750', 'Ron Caldas 750 ml', 110000, 'cat-licores', true, NOW(), NOW()),
  ('prod-ron-caldas5-375', 'Ron Caldas 5 Años 375 ml', 70000, 'cat-licores', true, NOW(), NOW()),
  ('prod-ron-caldas5-750', 'Ron Caldas 5 Años 750 ml', 120000, 'cat-licores', true, NOW(), NOW()),
  ('prod-detodito', 'DeTodito Rojo', 12000, 'cat-snaks', true, NOW(), NOW()),
  ('prod-trident', 'Trident', 3000, 'cat-snaks', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Formas del layout (plano de la discoteca)
INSERT INTO shapes (id, type, x, y, width, height, rotation, color, "zIndex", "createdAt", "updatedAt") VALUES
  ('shape-line-top', 'LINE', -525.89, 141.84, 0.25, 180.25, 0, '#C8A84E', 1, NOW(), NOW()),
  ('shape-line-bottom', 'LINE', 505.30, 1270.74, 213, 0.5, 0, '#C8A84E', 2, NOW(), NOW()),
  ('shape-rect-left', 'RECTANGLE', -525.64, 322.09, 97, 424.01, 0, '#C8A84E', 3, NOW(), NOW()),
  ('shape-rect-bar', 'RECTANGLE', -94.06, 1271.24, 600, 97.27, 0, '#C8A84E', 4, NOW(), NOW()),
  ('shape-rect-right', 'RECTANGLE', -190.17, 1270.74, 96.11, 334.55, 0, '#C8A84E', 5, NOW(), NOW()),
  ('shape-line-right', 'LINE', 717.80, 141.98, 0.5, 1464.09, 0, '#C8A84E', 6, NOW(), NOW()),
  ('shape-line-bottom2', 'LINE', -527.30, 1604.91, 1245.12, 0.49, 0, '#C8A84E', 7, NOW(), NOW()),
  ('shape-text-lat2', 'TEXT', -602.25, 956.13, 250.25, 73.71, -89.74, '#ffffff', 8, NOW(), NOW()),
  ('shape-line-mid1', 'LINE', -525.64, 746.09, 0, 50.5, 0, '#C8A84E', 9, NOW(), NOW()),
  ('shape-line-top2', 'LINE', -525.64, 141.61, 1244.33, 0.11, 0, '#C8A84E', 10, NOW(), NOW()),
  ('shape-line-mid2', 'LINE', -526.89, 1188.60, 0.75, 416.13, 0, '#C8A84E', 11, NOW(), NOW()),
  ('shape-text-barra', 'TEXT', 124.24, 1284.52, 162.13, 69.72, 0, '#ffffff', 12, NOW(), NOW()),
  ('shape-rect-left2', 'RECTANGLE', -525.89, 796.59, 97.52, 392.77, 0, '#C8A84E', 13, NOW(), NOW()),
  ('shape-text-lat1', 'TEXT', -606.19, 497.59, 258.12, 72.99, 269.64, '#ffffff', 14, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Actualizar labels de los textos
UPDATE shapes SET label = 'LATERAL 2' WHERE id = 'shape-text-lat2';
UPDATE shapes SET label = 'BARRA' WHERE id = 'shape-text-barra';
UPDATE shapes SET label = 'LATERAL 1' WHERE id = 'shape-text-lat1';
