-- DropIndex
DROP INDEX `site_visits_created_at_idx` ON `site_visits`;

-- DropIndex
DROP INDEX `site_visits_visitor_id_idx` ON `site_visits`;

-- AlterTable
ALTER TABLE `shopping_cart_sessions` ADD COLUMN `applied_coupon_code` VARCHAR(50) NULL;

-- AlterTable
ALTER TABLE `site_visits` MODIFY `visitor_id` VARCHAR(191) NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `live_sessions` (
    `session_id` VARCHAR(191) NOT NULL,
    `last_active` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
