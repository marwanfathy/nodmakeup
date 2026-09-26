-- Supports the catalogue listing query that every shop, bestseller and
-- collection page issues: WHERE is_active AND is_archived ORDER BY id DESC.
-- `products` carried no index other than the unique slug, so each of those
-- requests full-scanned the table and filesorted the result.
--
-- This migration is CREATE-only — no drops — so it is safe to apply while the
-- running instances keep serving reads.
CREATE INDEX `idx_products_active_archived_id` ON `products`(`is_active`, `is_archived`, `product_id`);
