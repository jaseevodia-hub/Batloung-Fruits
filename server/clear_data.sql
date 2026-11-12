/* =========================================================================
   Clear all business data
   Empties every data table so the app pages start with no records.
   Reference/dropdown data (provinces, box_sizes, order_statuses, menu_items)
   is preserved so the forms still work.
   Safe to run more than once.
   ========================================================================= */

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `order_items`;
TRUNCATE TABLE `orders`;
TRUNCATE TABLE `purchases`;
TRUNCATE TABLE `products`;
TRUNCATE TABLE `fruit_source_provinces`;
TRUNCATE TABLE `fruits`;
TRUNCATE TABLE `suppliers`;
TRUNCATE TABLE `street_vendors`;
TRUNCATE TABLE `users`;

SET FOREIGN_KEY_CHECKS = 1;
