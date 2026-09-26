-- AlterTable
ALTER TABLE `token_blocklist` ALTER COLUMN `expires_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `hero_sections` (
    `hero_section_id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hero_sections_title_key`(`title`),
    UNIQUE INDEX `hero_sections_slug_key`(`slug`),
    PRIMARY KEY (`hero_section_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hero_media_items` (
    `hero_media_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `hero_section_id` INTEGER NOT NULL,
    `media_url` VARCHAR(255) NOT NULL,
    `media_type` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `alt_text` VARCHAR(255) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `layout_style` ENUM('BACKGROUND_FULL', 'FOREGROUND_LEFT', 'FOREGROUND_RIGHT', 'FOREGROUND_CENTER', 'FOREGROUND_FLOAT_1', 'FOREGROUND_FLOAT_2') NOT NULL DEFAULT 'BACKGROUND_FULL',

    PRIMARY KEY (`hero_media_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hero_media_items` ADD CONSTRAINT `hero_media_items_hero_section_id_fkey` FOREIGN KEY (`hero_section_id`) REFERENCES `hero_sections`(`hero_section_id`) ON DELETE CASCADE ON UPDATE CASCADE;
