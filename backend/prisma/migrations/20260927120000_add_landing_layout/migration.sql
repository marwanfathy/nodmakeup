-- Landing-page layout: one row per homepage section, holding its position,
-- whether it is shown, and per-section settings.
--
-- The section LIST is not in this table — it is registered in code at
-- shared/src/landing/sections.ts, so adding a section later needs no migration.
-- See the LandingSection model comment in schema.prisma for why a section with
-- no row here is enabled and in registry order.
--
-- Generated with:
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- and extracted verbatim, so it matches what Prisma itself would emit.

CREATE TABLE `landing_sections` (
    `landing_section_id` VARCHAR(36) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `landing_sections_key_key`(`key`),
    PRIMARY KEY (`landing_section_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
