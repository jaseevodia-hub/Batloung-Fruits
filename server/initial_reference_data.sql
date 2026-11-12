-- Safe, repeatable reference data for forms that use dropdowns.
-- Run after server/database.sql when setting up a new database.
-- INSERT IGNORE preserves any existing rows with the same unique name.

INSERT IGNORE INTO provinces (id, name) VALUES
  (1, 'Eastern Cape'),
  (2, 'Free State'),
  (3, 'Gauteng'),
  (4, 'KwaZulu-Natal'),
  (5, 'Limpopo'),
  (6, 'Mpumalanga'),
  (7, 'Northern Cape'),
  (8, 'North West'),
  (9, 'Western Cape');

INSERT IGNORE INTO box_sizes (id, size_name, description) VALUES
  (1, 'Small', 'Small box for lower-volume orders'),
  (2, 'Medium', 'Medium box for regular orders'),
  (3, 'Large', 'Large box for higher-volume orders');
