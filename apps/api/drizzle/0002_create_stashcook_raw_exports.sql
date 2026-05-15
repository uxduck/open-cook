CREATE TABLE IF NOT EXISTS `stashcook_raw_exports` (
  `key` text PRIMARY KEY NOT NULL,
  `payload_json` text NOT NULL,
  `source_path` text NOT NULL,
  `imported_at` text NOT NULL
);

CREATE INDEX IF NOT EXISTS `stashcook_raw_exports_imported_at_idx`
ON `stashcook_raw_exports` (`imported_at`);
