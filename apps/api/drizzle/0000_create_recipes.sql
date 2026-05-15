CREATE TABLE `recipes` (
  `id` text PRIMARY KEY NOT NULL,
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
  `updated_at` text NOT NULL
);

CREATE INDEX `recipes_title_idx` ON `recipes` (`title`);
CREATE INDEX `recipes_updated_at_idx` ON `recipes` (`updated_at`);
