/*
  Warnings:

  - Added the required column `bundleId` to the `stories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `stories` ADD COLUMN `bundleId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;
