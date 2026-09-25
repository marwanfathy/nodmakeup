/*
  Warnings:

  - You are about to drop the `hero_media_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `hero_media_items` DROP FOREIGN KEY `hero_media_items_hero_section_id_fkey`;

-- AlterTable
ALTER TABLE `hero_sections` ADD COLUMN `description` TEXT NULL;

-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;

-- DropTable
DROP TABLE `hero_media_items`;

-- CreateTable
CREATE TABLE `hero_slides` (
    `hero_slide_id` INTEGER NOT NULL AUTO_INCREMENT,
    `hero_section_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `subtitle` VARCHAR(255) NULL,
    `link_url` VARCHAR(255) NOT NULL,
    `media_url` VARCHAR(255) NOT NULL,
    `media_type` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `thumbnail_url` VARCHAR(255) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`hero_slide_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hero_slides` ADD CONSTRAINT `hero_slides_hero_section_id_fkey` FOREIGN KEY (`hero_section_id`) REFERENCES `hero_sections`(`hero_section_id`) ON DELETE CASCADE ON UPDATE CASCADE;
