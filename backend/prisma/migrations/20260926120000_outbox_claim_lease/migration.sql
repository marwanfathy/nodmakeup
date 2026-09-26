-- Lease timestamp for the outbox claim, so the sweeper can reclaim a row whose
-- worker died mid-dispatch. Previously only PENDING rows were swept, which
-- stranded every PROCESSING row forever: the order notification was silently
-- dropped and nothing ever read the `attempts` counter.
ALTER TABLE `outbox_events` ADD COLUMN `claimed_at` TIMESTAMP(0) NULL;

-- The sweeper's hot query is "claimable or lease-expired", oldest first.
CREATE INDEX `idx_outbox_status_claimed_at` ON `outbox_events`(`status`, `claimed_at`);
