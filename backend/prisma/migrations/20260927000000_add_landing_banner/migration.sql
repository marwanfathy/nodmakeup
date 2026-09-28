-- CreateTable
CREATE TABLE `landing_banners` (
    `landing_banner_id` VARCHAR(36) NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `image_alt` VARCHAR(255) NULL,
    `tagline` VARCHAR(120) NOT NULL,
    `tagline_ar` VARCHAR(120) NULL,
    `title` VARCHAR(120) NOT NULL,
    `title_ar` VARCHAR(120) NULL,
    `cta_label` VARCHAR(60) NOT NULL,
    `cta_label_ar` VARCHAR(60) NULL,
    `cta_url` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`landing_banner_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
