ALTER TABLE `recipes` ADD COLUMN `visibility` text NOT NULL DEFAULT 'private';
--> statement-breakpoint
CREATE INDEX `recipes_visibility_idx` ON `recipes` (`visibility`);
--> statement-breakpoint
CREATE TABLE `recipe_shares` (
  `owner_id` text NOT NULL,
  `recipe_id` text NOT NULL,
  `shared_with_user_id` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`owner_id`, `recipe_id`, `shared_with_user_id`),
  FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE cascade,
  FOREIGN KEY (`shared_with_user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
  FOREIGN KEY (`owner_id`, `recipe_id`) REFERENCES `recipes`(`user_id`, `id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_shares_shared_with_idx` ON `recipe_shares` (`shared_with_user_id`);
--> statement-breakpoint
CREATE INDEX `recipe_shares_owner_recipe_idx` ON `recipe_shares` (`owner_id`, `recipe_id`);
