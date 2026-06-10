ALTER TABLE `recipe_shares` ADD COLUMN `seen_at` text;
--> statement-breakpoint
ALTER TABLE `recipe_shares` ADD COLUMN `dismissed_at` text;
--> statement-breakpoint
ALTER TABLE `recipe_shares` ADD COLUMN `copied_recipe_id` text;
--> statement-breakpoint
CREATE INDEX `recipe_shares_inbox_idx` ON `recipe_shares` (`shared_with_user_id`, `dismissed_at`, `created_at`);
