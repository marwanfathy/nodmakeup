-- AlterTable
ALTER TABLE `discounts` ADD COLUMN `assigned_phone` VARCHAR(20) NULL,
    ADD COLUMN `category` VARCHAR(50) NOT NULL DEFAULT 'PUBLIC',
    ADD COLUMN `current_usages` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `max_usages` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `is_reward_sent` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;
