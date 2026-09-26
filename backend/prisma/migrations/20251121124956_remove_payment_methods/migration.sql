/*
  Warnings:

  - You are about to drop the column `available_payment_methods` on the `shipping_zones` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[status_name]` on the table `order_statuses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `shipping_zones` DROP COLUMN `available_payment_methods`;

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX `order_statuses_status_name_key` ON `order_statuses`(`status_name`);
