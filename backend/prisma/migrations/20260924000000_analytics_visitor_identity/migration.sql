-- =====================================================================
-- Analytics visitor identity (first-party) + durable analytics tables.
--
-- Idempotent DDL so it is safe on BOTH paths:
--   * dev DBs created with `prisma db push` (tables may exist) and
--   * fresh DBs created by `prisma migrate deploy` (historical migrations
--     create site_visits; user_events / live_sessions never existed).
--
-- Guards use information_schema + prepared statements because MySQL does
-- not support `ADD COLUMN IF NOT EXISTS` (MariaDB does, but the 20251108
-- migration history adds `visitor_id` to site_visits on the fresh path).
-- =====================================================================

-- --- site_visits.visitor_id (column may or may not exist) ------------
SET @sv_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'site_visits' AND COLUMN_NAME = 'visitor_id');
SET @sv_sql := IF(@sv_col = 0,
    'ALTER TABLE `site_visits` ADD COLUMN `visitor_id` VARCHAR(191) NULL DEFAULT NULL AFTER `session_id`',
    'SELECT 1');
PREPARE sv_stmt FROM @sv_sql; EXECUTE sv_stmt; DEALLOCATE PREPARE sv_stmt;

SET @sv_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'site_visits' AND INDEX_NAME = 'site_visits_visitor_id_created_at_idx');
SET @sv_idx_sql := IF(@sv_idx = 0,
    'ALTER TABLE `site_visits` ADD INDEX `site_visits_visitor_id_created_at_idx` (`visitor_id`, `created_at`)',
    'SELECT 1');
PREPARE sv_idx_stmt FROM @sv_idx_sql; EXECUTE sv_idx_stmt; DEALLOCATE PREPARE sv_idx_stmt;

-- --- user_events (fresh-env creation, no-op when db-pushed) ----------
CREATE TABLE IF NOT EXISTS `user_events` (
    `id` VARCHAR(36) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `visitor_id` VARCHAR(191) NULL DEFAULT NULL,
    `type` VARCHAR(32) NOT NULL,
    `target` VARCHAR(255) NULL,
    `label` VARCHAR(255) NULL,
    `href` VARCHAR(255) NULL,
    `value` INT NULL,
    `path` VARCHAR(255) NULL,
    `meta` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @ue_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_events' AND COLUMN_NAME = 'visitor_id');
SET @ue_sql := IF(@ue_col = 0,
    'ALTER TABLE `user_events` ADD COLUMN `visitor_id` VARCHAR(191) NULL DEFAULT NULL AFTER `session_id`',
    'SELECT 1');
PREPARE ue_stmt FROM @ue_sql; EXECUTE ue_stmt; DEALLOCATE PREPARE ue_stmt;

-- user_events indexes (guarded: already present after `prisma db push`)
CREATE INDEX `user_events_created_at_idx` ON `user_events` (`created_at`);
CREATE INDEX `user_events_type_created_at_idx` ON `user_events` (`type`, `created_at`);
CREATE INDEX `user_events_target_created_at_idx` ON `user_events` (`target`, `created_at`);
CREATE INDEX `user_events_label_created_at_idx` ON `user_events` (`label`, `created_at`);
CREATE INDEX `user_events_visitor_id_created_at_idx` ON `user_events` (`visitor_id`, `created_at`);

-- --- live_sessions (fresh-env creation, no-op when db-pushed) --------
CREATE TABLE IF NOT EXISTS `live_sessions` (
    `session_id` VARCHAR(191) NOT NULL,
    `last_active` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @ls_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'live_sessions' AND INDEX_NAME = 'live_sessions_last_active_idx');
SET @ls_sql := IF(@ls_idx = 0,
    'ALTER TABLE `live_sessions` ADD INDEX `live_sessions_last_active_idx` (`last_active`)',
    'SELECT 1');
PREPARE ls_stmt FROM @ls_sql; EXECUTE ls_stmt; DEALLOCATE PREPARE ls_stmt;