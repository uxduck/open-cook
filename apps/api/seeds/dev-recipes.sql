-- Dev-only recipe seed data.
-- Do not apply this automatically or in production.
-- When recipe ownership is added, update this file to seed these rows for a
-- specific Better Auth user id.

INSERT INTO `recipes` (
  `id`,
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
) VALUES (
  'seed-roast-tomato-pasta',
  'Roast Tomato Pantry Pasta',
  'A reliable weeknight pasta built from cherry tomatoes, garlic, and a little reserved pasta water.',
  'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80',
  '{"name":"OpenCook dev seed","importedAt":"2026-01-01T00:00:00.000Z"}',
  10,
  25,
  35,
  '2-3',
  '["pasta","vegetarian","weeknight"]',
  '[{"text":"250 g short pasta"},{"text":"400 g cherry tomatoes"},{"text":"3 garlic cloves, thinly sliced"},{"text":"2 tbsp olive oil"},{"text":"A handful of basil"}]',
  '[{"text":"Roast tomatoes, garlic, olive oil, salt, and pepper at 210 C until collapsed."},{"text":"Boil pasta until just shy of al dente, reserving a mug of water."},{"text":"Toss pasta through the tomatoes with splashes of pasta water."},{"text":"Finish with basil, olive oil, and black pepper."}]',
  '["Add chilli flakes if the tomatoes are very sweet."]',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
)
ON CONFLICT(`id`) DO UPDATE SET
  `title` = excluded.`title`,
  `description` = excluded.`description`,
  `image_url` = excluded.`image_url`,
  `source_json` = excluded.`source_json`,
  `prep_time_minutes` = excluded.`prep_time_minutes`,
  `cook_time_minutes` = excluded.`cook_time_minutes`,
  `total_time_minutes` = excluded.`total_time_minutes`,
  `servings` = excluded.`servings`,
  `tags_json` = excluded.`tags_json`,
  `ingredients_json` = excluded.`ingredients_json`,
  `steps_json` = excluded.`steps_json`,
  `notes_json` = excluded.`notes_json`,
  `updated_at` = excluded.`updated_at`;

INSERT INTO `recipes` (
  `id`,
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
) VALUES (
  'seed-ginger-miso-salmon',
  'Ginger Miso Salmon Bowls',
  'A quick bowl format for rice, greens, and glazed salmon with sharp pickles.',
  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=80',
  '{"name":"OpenCook dev seed","importedAt":"2026-01-01T00:00:00.000Z"}',
  15,
  12,
  27,
  '2',
  '["salmon","rice bowl","quick"]',
  '[{"text":"2 salmon fillets"},{"text":"1 tbsp white miso"},{"text":"1 tbsp soy sauce"},{"text":"1 tsp grated ginger"},{"text":"Cooked rice and greens, to serve"}]',
  '[{"text":"Mix miso, soy, ginger, and a splash of water into a paste."},{"text":"Brush over salmon and grill or air-fry until burnished."},{"text":"Serve over rice with greens and pickles."}]',
  '["Works well with tofu in place of salmon."]',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
)
ON CONFLICT(`id`) DO UPDATE SET
  `title` = excluded.`title`,
  `description` = excluded.`description`,
  `image_url` = excluded.`image_url`,
  `source_json` = excluded.`source_json`,
  `prep_time_minutes` = excluded.`prep_time_minutes`,
  `cook_time_minutes` = excluded.`cook_time_minutes`,
  `total_time_minutes` = excluded.`total_time_minutes`,
  `servings` = excluded.`servings`,
  `tags_json` = excluded.`tags_json`,
  `ingredients_json` = excluded.`ingredients_json`,
  `steps_json` = excluded.`steps_json`,
  `notes_json` = excluded.`notes_json`,
  `updated_at` = excluded.`updated_at`;
