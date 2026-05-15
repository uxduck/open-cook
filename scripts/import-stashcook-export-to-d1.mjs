#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const exportDir =
  process.env.STASHCOOK_EXPORT_DIR ?? "artifacts/stashcook-export/latest";
const dbPath =
  process.env.OPEN_COOK_D1_DB ??
  (await discoverD1DatabasePath(
    "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject",
  ));
const importedAt = new Date().toISOString();

const recipesPath = path.join(exportDir, "recipes.json");
const revisionsPath = path.join(exportDir, "recipe-revisions.json");

const recipes = await readJson(recipesPath);
const revisions = await readJson(revisionsPath).catch(() => []);
const revisionById = new Map(
  (Array.isArray(revisions) ? revisions : [])
    .filter((revision) => isObjectRecord(revision) && typeof revision.id === "string")
    .map((revision) => [revision.id, revision]),
);

if (!Array.isArray(recipes)) {
  throw new Error(`${recipesPath} must contain an array of recipes.`);
}

const activeRecipes = recipes.filter(isObjectRecord);
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON");
ensureTables(db);

const insertRecipe = db.prepare(`
  INSERT INTO recipes (
    id,
    title,
    description,
    image_url,
    source_json,
    prep_time_minutes,
    cook_time_minutes,
    total_time_minutes,
    servings,
    tags_json,
    ingredients_json,
    steps_json,
    notes_json,
    created_at,
    updated_at
  ) VALUES (
    $id,
    $title,
    $description,
    $imageUrl,
    $source,
    $prepTimeMinutes,
    $cookTimeMinutes,
    $totalTimeMinutes,
    $servings,
    $tags,
    $ingredients,
    $steps,
    $notes,
    $createdAt,
    $updatedAt
  )
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    image_url = excluded.image_url,
    source_json = excluded.source_json,
    prep_time_minutes = excluded.prep_time_minutes,
    cook_time_minutes = excluded.cook_time_minutes,
    total_time_minutes = excluded.total_time_minutes,
    servings = excluded.servings,
    tags_json = excluded.tags_json,
    ingredients_json = excluded.ingredients_json,
    steps_json = excluded.steps_json,
    notes_json = excluded.notes_json,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at
`);

const insertRawExport = db.prepare(`
  INSERT INTO stashcook_raw_exports (
    key,
    payload_json,
    source_path,
    imported_at
  ) VALUES (
    $key,
    $payloadJson,
    $sourcePath,
    $importedAt
  )
  ON CONFLICT(key) DO UPDATE SET
    payload_json = excluded.payload_json,
    source_path = excluded.source_path,
    imported_at = excluded.imported_at
`);

let rawExportCount = 0;

db.exec("BEGIN");
try {
  for (const recipe of activeRecipes) {
    insertRecipe.run(recipeToRow(recipe, revisionById.get(recipe.id)));
  }

  for (const filename of await readdir(exportDir)) {
    if (!filename.endsWith(".json")) {
      continue;
    }
    const sourcePath = path.join(exportDir, filename);
    const payloadJson = await readFile(sourcePath, "utf8");
    insertRawExport.run({
      key: filename.replace(/\.json$/i, ""),
      payloadJson,
      sourcePath,
      importedAt,
    });
    rawExportCount += 1;
  }

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

const stashcookRecipeCount = db
  .prepare("SELECT COUNT(*) AS count FROM recipes WHERE id LIKE 'stashcook-%'")
  .get().count;
const totalRecipeCount = db
  .prepare("SELECT COUNT(*) AS count FROM recipes")
  .get().count;
const rawTableCount = db
  .prepare("SELECT COUNT(*) AS count FROM stashcook_raw_exports")
  .get().count;

console.log(
  JSON.stringify(
    {
      dbPath,
      importedRecipes: activeRecipes.length,
      stashcookRecipesInDb: stashcookRecipeCount,
      totalRecipesInDb: totalRecipeCount,
      rawExportFilesImported: rawExportCount,
      rawExportRowsInDb: rawTableCount,
    },
    null,
    2,
  ),
);

function ensureTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS stashcook_raw_exports (
      key text PRIMARY KEY NOT NULL,
      payload_json text NOT NULL,
      source_path text NOT NULL,
      imported_at text NOT NULL
    )
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS stashcook_raw_exports_imported_at_idx
    ON stashcook_raw_exports (imported_at)
  `);
}

async function discoverD1DatabasePath(directory) {
  const filenames = await readdir(directory);
  const databases = filenames
    .filter(
      (filename) => filename.endsWith(".sqlite") && filename !== "metadata.sqlite",
    )
    .map((filename) => path.join(directory, filename));

  if (databases.length !== 1) {
    throw new Error(
      `Expected one local D1 sqlite database in ${directory}; found ${databases.length}. Set OPEN_COOK_D1_DB explicitly.`,
    );
  }

  return databases[0];
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function recipeToRow(recipe, revision) {
  const externalId = stringValue(recipe.id);
  if (!externalId) {
    throw new Error(`Recipe is missing id: ${JSON.stringify(recipe).slice(0, 200)}`);
  }

  const createdAt = isoTimestamp(recipe.createdTimestampUtc) ?? importedAt;
  const updatedAt = isoTimestamp(recipe.updatedTimestampUtc) ?? createdAt;
  const source = objectValue(recipe.source);
  const sourceUrl = validUrl(stringValue(source?.url));
  const sourceName = stringValue(source?.name);
  const raw = revision ? { recipe, revision } : { recipe };

  return {
    id: `stashcook-${externalId}`,
    title: stringValue(recipe.name) ?? stringValue(recipe.title) ?? "Untitled recipe",
    description:
      stringValue(recipe.description) ??
      stringValue(recipe.summary) ??
      stringValue(recipe.introduction) ??
      null,
    imageUrl: firstImageUrl(recipe) ?? null,
    source: JSON.stringify({
      name: sourceName ?? "StashCook",
      ...(sourceUrl ? { url: sourceUrl } : {}),
      externalId,
      importedAt,
      raw,
    }),
    prepTimeMinutes: numberValue(recipe.prepTimeMinutes),
    cookTimeMinutes: numberValue(recipe.cookTimeMinutes),
    totalTimeMinutes: numberValue(recipe.totalTimeMinutes),
    servings:
      stringValue(recipe.servings) ?? stringValue(recipe.servingsAdjusted) ?? null,
    tags: JSON.stringify(stringsFromUnknown(recipe.tags)),
    ingredients: JSON.stringify(
      toTextRows(nonEmptyArray(recipe.ingredients2) ?? recipe.ingredients),
    ),
    steps: JSON.stringify(toTextRows(nonEmptyArray(recipe.method) ?? recipe.steps)),
    notes: JSON.stringify(stringsFromUnknown(recipe.notes)),
    createdAt,
    updatedAt,
  };
}

function toTextRows(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text }));
  }

  if (!Array.isArray(value)) {
    return [];
  }

  let section;

  return [...value]
    .sort((a, b) => numberValue(a?.index, 0) - numberValue(b?.index, 0))
    .flatMap((item) => {
      if (typeof item === "string") {
        return [{ section, text: item }];
      }
      if (!isObjectRecord(item)) {
        return [];
      }

      const text =
        stringValue(item.text) ??
        stringValue(item.description) ??
        stringValue(item.instruction) ??
        stringValue(item.name) ??
        ingredientObjectToText(item);

      if (!text) {
        return [];
      }

      if (item.isSectionHeader === true) {
        section = text;
        return [];
      }

      return [{ ...(section ? { section } : {}), text }];
    });
}

function ingredientObjectToText(item) {
  const products = Array.isArray(item.products)
    ? item.products.map(stringValue).filter(Boolean).join(", ")
    : undefined;
  const quantity = objectValue(item.quantity);
  const measurements = objectValue(item.measurements);
  const base = objectValue(measurements?.base);
  const original = objectValue(base?.original);
  const amount =
    stringValue(quantity?.quantityLower) ??
    stringValue(quantity?.quantityTotal) ??
    stringValue(original?.quantityLower) ??
    stringValue(original?.quantityTotal);
  const unit = stringValue(quantity?.unit) ?? stringValue(original?.unit);

  return [amount, unit, products].filter(Boolean).join(" ").trim() || undefined;
}

function stringsFromUnknown(value) {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (isObjectRecord(item)) {
        return (
          stringValue(item.name) ??
          stringValue(item.tag) ??
          stringValue(item.title) ??
          stringValue(item.text) ??
          stringValue(item.value)
        );
      }
      return undefined;
    })
    .filter(Boolean);
}

function firstImageUrl(recipe) {
  const direct =
    validUrl(stringValue(recipe.imageUrl)) ??
    validUrl(stringValue(recipe.primaryImageUrl)) ??
    validUrl(stringValue(recipe.thumbnailUrl)) ??
    validUrl(stringValue(recipe.photoUrl));
  if (direct) {
    return direct;
  }

  const images = Array.isArray(recipe.images) ? recipe.images : [];
  for (const image of images) {
    if (!isObjectRecord(image)) {
      continue;
    }
    const imageUrl =
      validUrl(stringValue(image.large)) ??
      validUrl(stringValue(image.base)) ??
      validUrl(stringValue(image.medium)) ??
      validUrl(stringValue(image.small));
    if (imageUrl) {
      return imageUrl;
    }
  }

  return undefined;
}

function isoTimestamp(value) {
  const text = stringValue(value);
  if (!text) {
    return undefined;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function validUrl(value) {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value) {
  if (typeof value === "string") {
    return value.trim() || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function numberValue(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }
  return fallback;
}

function objectValue(value) {
  return isObjectRecord(value) ? value : undefined;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0 ? value : undefined;
}

function isObjectRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
