-- CreateTable
CREATE TABLE `customer_profiles` (
    `customer_profile_id` VARCHAR(36) NOT NULL,
    `customer_name` VARCHAR(200) NOT NULL,
    `customer_phone` VARCHAR(20) NOT NULL,
    `email` VARCHAR(200) NULL,
    `governorate` VARCHAR(100) NULL,
    `address` VARCHAR(255) NULL,
    `tags` JSON NOT NULL,
    `segment` VARCHAR(50) NOT NULL DEFAULT 'NEW',
    `total_orders` INTEGER NOT NULL DEFAULT 0,
    `total_spent` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `last_order_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `customer_profiles_customer_phone_key`(`customer_phone`),
    PRIMARY KEY (`customer_profile_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_notes` (
    `customer_note_id` VARCHAR(36) NOT NULL,
    `customer_profile_id` VARCHAR(36) NOT NULL,
    `admin_id` VARCHAR(36) NULL,
    `note` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_customer_notes_customer_id`(`customer_profile_id`),
    PRIMARY KEY (`customer_note_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_notes` ADD CONSTRAINT `customer_notes_customer_profile_id_fkey` FOREIGN KEY (`customer_profile_id`) REFERENCES `customer_profiles`(`customer_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_notes` ADD CONSTRAINT `customer_notes_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;

