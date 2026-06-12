CREATE TABLE `gatherings` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `prompt` text,
  `welcome` text NOT NULL,
  `dietary` text,
  `guest_question` text NOT NULL,
  `recipe_ids_json` text NOT NULL,
  `invitees_json` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `published_at` text,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `gatherings_slug_unique` ON `gatherings` (`slug`);
CREATE INDEX `gatherings_user_updated_at_idx` ON `gatherings` (`user_id`, `updated_at`);
CREATE INDEX `gatherings_slug_idx` ON `gatherings` (`slug`);
CREATE INDEX `gatherings_status_idx` ON `gatherings` (`status`);

CREATE TABLE `gathering_responses` (
  `id` text PRIMARY KEY NOT NULL,
  `gathering_id` text NOT NULL,
  `guest_name` text NOT NULL,
  `email` text,
  `selected_recipe_ids_json` text NOT NULL,
  `bringing` text,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`gathering_id`) REFERENCES `gatherings`(`id`) ON DELETE cascade
);

CREATE INDEX `gathering_responses_gathering_created_idx` ON `gathering_responses` (`gathering_id`, `created_at`);
