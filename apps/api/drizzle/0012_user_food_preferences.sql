CREATE TABLE `user_food_preferences` (
  `user_id` text PRIMARY KEY NOT NULL,
  `preferences_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
