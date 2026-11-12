/* =========================================================================
   Reference data migration
   Moves previously hardcoded application data (order statuses and the
   sidebar navigation menu) into the database so the frontend reads it
   from MySQL instead of static arrays.
   Safe to run more than once.
   ========================================================================= */

CREATE TABLE IF NOT EXISTS `order_statuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `order_statuses` (`code`, `label`, `sort_order`) VALUES
  ('pending', 'Pending', 1),
  ('confirmed', 'Confirmed', 2),
  ('processing', 'Processing', 3),
  ('ready_for_collection', 'Ready for Collection/Delivery', 4),
  ('completed', 'Completed', 5),
  ('cancelled', 'Cancelled', 6)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `sort_order` = VALUES(`sort_order`);

CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `path` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `path` (`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `menu_items` (`name`, `path`, `icon`, `sort_order`) VALUES
  ('Dashboard', '/', '🏠', 1),
  ('Fruits', '/fruits', '🍎', 2),
  ('Suppliers', '/suppliers', '🚚', 3),
  ('Street Vendors', '/vendors', '🏪', 4),
  ('Stock Management', '/stock', '📦', 5),
  ('Orders', '/orders', '🛒', 6),
  ('Reports', '/reports', '📊', 7)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `icon` = VALUES(`icon`),
  `sort_order` = VALUES(`sort_order`);
