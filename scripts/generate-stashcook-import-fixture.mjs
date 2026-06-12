#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const defaultOutputDir = "artifacts/stashcook-export/dev-fixture";
const defaultRecipeCount = 132;

const mains = [
  "Aubergine",
  "Lemon",
  "Tomato",
  "Chickpea",
  "Miso",
  "Squash",
  "Mushroom",
  "Cauliflower",
  "Halloumi",
  "Lentil",
  "Spinach",
  "Black Bean",
];

const formats = [
  "Traybake",
  "Rice Bowls",
  "Pasta",
  "Soup",
  "Tacos",
  "Skillet",
  "Curry",
  "Noodles",
  "Salad",
  "Flatbreads",
];

const styles = [
  "Ginger",
  "Herby",
  "Smoky",
  "Sesame",
  "Garlic",
  "Harissa",
  "Coconut",
  "Sage",
];

const pantryItems = [
  "olive oil",
  "soy sauce",
  "white miso",
  "tahini",
  "tomato paste",
  "coconut milk",
  "vegetable stock",
  "rice vinegar",
];

const garnishItems = [
  "parsley",
  "spring onions",
  "toasted sesame seeds",
  "lemon wedges",
  "crispy onions",
  "basil",
];

const tagSets = [
  ["Dinner", "Weeknight", "Vegetarian"],
  ["Lunch", "Batch cook", "Freezer friendly"],
  ["Quick", "Pantry", "One pot"],
  ["Family", "Comfort", "Make ahead"],
  ["Plant-forward", "High protein", "Budget"],
];

export async function main(argv = process.argv.slice(2), env = process.env) {
  const options = readOptions(argv, env);
  const outputDir = path.resolve(options.outputDir);
  const fixture = buildStashCookImportFixture(options);

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeJson(path.join(outputDir, "recipes.json"), fixture.recipes),
    writeJson(path.join(outputDir, "recipe-revisions.json"), fixture.revisions),
    writeJson(path.join(outputDir, "recipe-tags.json"), fixture.recipeTags),
    writeJson(path.join(outputDir, "manifest.json"), fixture.manifest),
    writeJson(path.join(outputDir, "profile.json"), fixture.profile),
  ]);

  console.log(
    JSON.stringify(
      {
        outputDir,
        recipesPath: path.join(outputDir, "recipes.json"),
        recipeCount: fixture.recipes.length,
        includeImages: options.includeImages,
      },
      null,
      2,
    ),
  );
}

export function buildStashCookImportFixture({
  count = defaultRecipeCount,
  includeImages = false,
} = {}) {
  const recipeCount = positiveInteger(count, defaultRecipeCount);
  const generatedAt = "2026-06-12T00:00:00.000Z";
  const recipes = Array.from({ length: recipeCount }, (_item, index) =>
    buildRecipe(index, { includeImages }),
  );
  const tagNames = [
    ...new Set(recipes.flatMap((recipe) => recipe.tags.map((tag) => tag.name))),
  ];

  return {
    recipes,
    revisions: recipes.map((recipe, index) => ({
      id: recipe.id,
      recipeId: recipe.id,
      revision: index + 1,
      updatedTimestampUtc: recipe.updatedTimestampUtc,
      note: "Generated fixture revision for local OpenCook import testing.",
    })),
    recipeTags: tagNames.map((name, index) => ({
      id: `fixture-tag-${String(index + 1).padStart(2, "0")}`,
      name,
    })),
    profile: {
      id: "fixture-profile",
      name: "OpenCook Fixture Cook",
    },
    manifest: {
      source: "open-cook generated StashCook import fixture",
      generatedAt,
      recipeCount,
      includeImages,
      files: [
        "recipes.json",
        "recipe-revisions.json",
        "recipe-tags.json",
        "manifest.json",
        "profile.json",
      ],
    },
  };
}

function buildRecipe(index, { includeImages }) {
  const n = index + 1;
  const id = `fixture-recipe-${String(n).padStart(3, "0")}`;
  const main = mains[index % mains.length];
  const style = styles[Math.floor(index / mains.length) % styles.length];
  const format = formats[index % formats.length];
  const pantry = pantryItems[index % pantryItems.length];
  const garnish = garnishItems[index % garnishItems.length];
  const prepTimeMinutes = 8 + (index % 6) * 3;
  const cookTimeMinutes = 12 + (index % 8) * 4;
  const createdAt = timestampFor(index, 0);
  const updatedAt = timestampFor(index, 17);
  const name = `${style} ${main} ${format}`;
  const tags = tagSets[index % tagSets.length].map(tagName);

  return {
    id,
    name,
    title: name,
    description: `Generated StashCook-style fixture recipe ${n} for testing OpenCook bulk imports.`,
    ...(includeImages
      ? {
          primaryImageUrl: `https://images.example.com/open-cook-fixture/${id}.jpg`,
        }
      : {}),
    source: {
      name: "OpenCook fixture",
      url: `https://example.test/open-cook-fixtures/${id}`,
    },
    sourceUrl: `https://example.test/open-cook-fixtures/${id}`,
    createdTimestampUtc: createdAt,
    updatedTimestampUtc: updatedAt,
    prepTimeMinutes,
    cookTimeMinutes,
    totalTimeMinutes: prepTimeMinutes + cookTimeMinutes,
    servings: String(2 + (index % 5)),
    tags,
    ingredients2: [
      ingredient("2", "", main.toLowerCase()),
      ingredient("1", "tbsp", pantry),
      ingredient("1", "clove", "garlic"),
      ingredient("200", "g", formatBase(format)),
      ingredient("", "", `${garnish}, for serving`),
    ],
    method: [
      {
        text: `Prep the ${main.toLowerCase()} and season with ${pantry}.`,
      },
      {
        text: `Cook until the ${main.toLowerCase()} is tender and the sauce is glossy.`,
      },
      {
        text: `Serve as ${format.toLowerCase()} with ${garnish}.`,
      },
    ],
    notes: [
      { text: "Generated fixture data, not a real user recipe." },
      {
        text:
          n % 4 === 0 ? "Good for batch import testing." : "Adjust seasoning to taste.",
      },
    ],
  };
}

function ingredient(amount, unit, productName) {
  return {
    amount,
    unit,
    productName,
    text: [amount, unit, productName].filter(Boolean).join(" "),
  };
}

function formatBase(format) {
  switch (format) {
    case "Rice Bowls":
      return "cooked rice";
    case "Pasta":
      return "short pasta";
    case "Soup":
      return "vegetable stock";
    case "Tacos":
      return "tortillas";
    case "Curry":
      return "coconut milk";
    case "Noodles":
      return "noodles";
    case "Salad":
      return "mixed leaves";
    case "Flatbreads":
      return "flatbread";
    default:
      return "new potatoes";
  }
}

function tagName(value) {
  return { name: value };
}

function timestampFor(index, minuteOffset) {
  return new Date(
    Date.UTC(2026, 0, 1 + Math.floor(index / 12), index % 24, minuteOffset),
  ).toISOString();
}

function readOptions(argv, env) {
  const args = parseArgs(argv);
  return {
    count: positiveInteger(
      args.count ?? env.STASHCOOK_FIXTURE_COUNT,
      defaultRecipeCount,
    ),
    outputDir: args.out ?? args.output ?? env.STASHCOOK_EXPORT_DIR ?? defaultOutputDir,
    includeImages: booleanOption(args.images ?? env.STASHCOOK_FIXTURE_IMAGES),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) {
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
      continue;
    }
    args[key] = "true";
  }
  return args;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanOption(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

async function writeJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
