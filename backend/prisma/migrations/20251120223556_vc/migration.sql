/*
  Warnings:

  - You are about to drop the column `media_type` on the `hero_slides` table. All the data in the column will be lost.
  - You are about to drop the column `media_url` on the `hero_slides` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `hero_slides` DROP COLUMN `media_type`,
    DROP COLUMN `media_url`;

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `hero_media_items` (
    `hero_media_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `slide_id` INTEGER NOT NULL,
    `media_url` VARCHAR(255) NOT NULL,
    `media_type` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `alt_text` VARCHAR(255) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `layout_style` ENUM('BACKGROUND_FULL', 'FOREGROUND_LEFT', 'FOREGROUND_RIGHT', 'FOREGROUND_CENTER', 'FOREGROUND_FLOAT_1', 'FOREGROUND_FLOAT_2') NOT NULL DEFAULT 'BACKGROUND_FULL',

    PRIMARY KEY (`hero_media_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hero_media_items` ADD CONSTRAINT `hero_media_items_slide_id_fkey` FOREIGN KEY (`slide_id`) REFERENCES `hero_slides`(`hero_slide_id`) ON DELETE CASCADE ON UPDATE CASCADE;
