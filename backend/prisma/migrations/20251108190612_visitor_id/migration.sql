-- AlterTable
ALTER TABLE `site_visits` ADD COLUMN `visitor_id` VARCHAR(191) NOT NULL DEFAULT 'legacy_visitor_id';

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `site_visits_visitor_id_idx` ON `site_visits`(`visitor_id`);
