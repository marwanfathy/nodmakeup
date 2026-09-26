-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `transactions` MODIFY `status` ENUM('Completed', 'Pending', 'Failed', 'Refunded') NOT NULL;
