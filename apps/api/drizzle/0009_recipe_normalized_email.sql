ALTER TABLE `user` ADD `normalized_email` text NOT NULL DEFAULT '';--> statement-breakpoint
-- Backfill existing accounts with a lowercase canonical key. This is a
-- simplified normalization (case only); the application normalizes new and
-- changed emails with the full Gmail-dot / + -alias rules via normalizeEmail().
UPDATE `user` SET `normalized_email` = lower(trim(`email`));--> statement-breakpoint
CREATE UNIQUE INDEX `user_normalized_email_unique` ON `user` (`normalized_email`);
