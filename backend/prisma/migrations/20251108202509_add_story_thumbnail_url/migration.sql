-- AlterTable
ALTER TABLE `stories` ADD COLUMN `thumbnail_url` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;
