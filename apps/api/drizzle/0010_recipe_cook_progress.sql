CREATE TABLE `recipe_cook_progress` (
  `user_id` text NOT NULL,
  `recipe_user_id` text NOT NULL,
  `recipe_id` text NOT NULL,
  `checked_ingredient_ids_json` text NOT NULL DEFAULT '[]',
  `checked_step_ids_json` text NOT NULL DEFAULT '[]',
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `recipe_user_id`, `recipe_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
  FOREIGN KEY (`recipe_user_id`, `recipe_id`) REFERENCES `recipes`(`user_id`, `id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_cook_progress_user_idx` ON `recipe_cook_progress` (`user_id`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `recipe_cook_progress_recipe_idx` ON `recipe_cook_progress` (`recipe_user_id`, `recipe_id`);
