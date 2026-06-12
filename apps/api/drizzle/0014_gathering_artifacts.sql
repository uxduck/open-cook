CREATE TABLE `gathering_artifacts` (
  `id` text PRIMARY KEY NOT NULL,
  `gathering_id` text NOT NULL,
  `kind` text NOT NULL,
  `label` text NOT NULL,
  `provider` text NOT NULL,
  `status` text NOT NULL,
  `prompt` text,
  `media_url` text,
  `content_type` text,
  `size` integer,
  `model` text,
  `request_id` text,
  `voice_id` text,
  `voice_name` text,
  `status_url` text,
  `response_url` text,
  `cancel_url` text,
  `error` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`gathering_id`) REFERENCES `gatherings`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `gathering_artifacts_gathering_kind_unique` ON `gathering_artifacts` (`gathering_id`, `kind`);
CREATE INDEX `gathering_artifacts_gathering_idx` ON `gathering_artifacts` (`gathering_id`);
CREATE INDEX `gathering_artifacts_request_idx` ON `gathering_artifacts` (`request_id`);
CREATE INDEX `gathering_artifacts_status_idx` ON `gathering_artifacts` (`status`);
