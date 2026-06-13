CREATE TABLE `cookbooks` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `kind` text DEFAULT 'top_level' NOT NULL,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `visibility` text DEFAULT 'private' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cookbooks_user_top_level_unique` ON `cookbooks` (`user_id`) WHERE kind = 'top_level';
--> statement-breakpoint
CREATE UNIQUE INDEX `cookbooks_slug_unique` ON `cookbooks` (`slug`);
--> statement-breakpoint
CREATE INDEX `cookbooks_user_updated_at_idx` ON `cookbooks` (`user_id`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `cookbooks_visibility_idx` ON `cookbooks` (`visibility`);
--> statement-breakpoint
CREATE TABLE `cookbook_recipes` (
  `cookbook_id` text NOT NULL,
  `recipe_user_id` text NOT NULL,
  `recipe_id` text NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  `added_at` text NOT NULL,
  PRIMARY KEY (`cookbook_id`, `recipe_user_id`, `recipe_id`),
  FOREIGN KEY (`cookbook_id`) REFERENCES `cookbooks`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`recipe_user_id`, `recipe_id`) REFERENCES `recipes`(`user_id`, `id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cookbook_recipes_recipe_idx` ON `cookbook_recipes` (`recipe_user_id`, `recipe_id`);
--> statement-breakpoint
CREATE INDEX `cookbook_recipes_position_idx` ON `cookbook_recipes` (`cookbook_id`, `position`);
