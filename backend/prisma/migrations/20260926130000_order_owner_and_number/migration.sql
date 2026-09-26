-- Expand-only. Records which anonymous cart session placed each order, so the
-- public confirmation endpoint can prove ownership instead of trusting a UUID
-- that leaks through URLs, referrers and logs. Nullable on purpose: existing
-- orders have no owner recorded, and the public read path requires a match, so
-- a null means "not customer-retrievable" instead of "retrievable by anyone".
-- Admin reads are unaffected.
ALTER TABLE `orders` ADD COLUMN `cart_session_id` VARCHAR(36) NULL;

CREATE INDEX `idx_orders_cart_session` ON `orders`(`cart_session_id`);
