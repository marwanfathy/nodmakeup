/*
  Warnings:

  - You are about to drop the column `password_hash` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `product_images` table. All the data in the column will be lost.
  - The values [Vodafone Cash] on the enum `transactions_payment_method` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `passwordHash` to the `admins` table without a default value. This is not possible if the table is not empty.
  - Made the column `variant_id` on table `product_images` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `product_images` DROP FOREIGN KEY `product_images_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `product_images` DROP FOREIGN KEY `product_images_variant_id_fkey`;

-- DropIndex
DROP INDEX `product_images_product_id_fkey` ON `product_images`;

-- DropIndex
DROP INDEX `product_images_variant_id_fkey` ON `product_images`;

-- AlterTable
ALTER TABLE `admins` DROP COLUMN `password_hash`,
    ADD COLUMN `passwordHash` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `product_images` DROP COLUMN `product_id`,
    MODIFY `variant_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `shipping_zones` ADD COLUMN `free_shipping_threshold` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `transactions` MODIFY `payment_method` ENUM('Cash on Delivery', 'Instapay', 'Wallet') NOT NULL;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`variant_id`) ON DELETE CASCADE ON UPDATE CASCADE;
