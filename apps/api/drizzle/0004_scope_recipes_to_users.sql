CREATE TABLE `recipes_user_scope_guard` (
  `id` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `recipes_user_scope_guard` (`id`)
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM `recipes`) = 0 OR COUNT(*) = 1 THEN 1
    ELSE NULL
  END
FROM `user`;
--> statement-breakpoint
DROP TABLE `recipes_user_scope_guard`;
--> statement-breakpoint
CREATE TABLE `recipes_next` (
  `id` text NOT NULL,
  `user_id` text NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `image_url` text,
  `source_json` text,
  `prep_time_minutes` integer,
  `cook_time_minutes` integer,
  `total_time_minutes` integer,
  `servings` text,
  `tags_json` text NOT NULL DEFAULT '[]',
  `ingredients_json` text NOT NULL DEFAULT '[]',
  `steps_json` text NOT NULL DEFAULT '[]',
  `notes_json` text NOT NULL DEFAULT '[]',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `recipes_next` (
  `id`,
  `user_id`,
  `title`,
  `description`,
  `image_url`,
  `source_json`,
  `prep_time_minutes`,
  `cook_time_minutes`,
  `total_time_minutes`,
  `servings`,
  `tags_json`,
  `ingredients_json`,
  `steps_json`,
  `notes_json`,
  `created_at`,
  `updated_at`
)
SELECT
  `recipes`.`id`,
  (SELECT `user`.`id` FROM `user` ORDER BY `user`.`created_at` LIMIT 1),
  `recipes`.`title`,
  `recipes`.`description`,
  `recipes`.`image_url`,
  `recipes`.`source_json`,
  `recipes`.`prep_time_minutes`,
  `recipes`.`cook_time_minutes`,
  `recipes`.`total_time_minutes`,
  `recipes`.`servings`,
  `recipes`.`tags_json`,
  `recipes`.`ingredients_json`,
  `recipes`.`steps_json`,
  `recipes`.`notes_json`,
  `recipes`.`created_at`,
  `recipes`.`updated_at`
FROM `recipes`;
--> statement-breakpoint
DROP TABLE `recipes`;
--> statement-breakpoint
ALTER TABLE `recipes_next` RENAME TO `recipes`;
--> statement-breakpoint
CREATE INDEX `recipes_user_id_idx` ON `recipes` (`user_id`);
--> statement-breakpoint
CREATE INDEX `recipes_user_title_idx` ON `recipes` (`user_id`, `title`);
--> statement-breakpoint
CREATE INDEX `recipes_user_updated_at_idx` ON `recipes` (`user_id`, `updated_at`);
