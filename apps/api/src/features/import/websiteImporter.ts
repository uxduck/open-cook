import { createRecipeRecord, decodeHtmlEntities, type Recipe } from "@open-cook/core";
import { appVersion } from "../../AppMetadata";
import { workersAiModels } from "../../ai/workersAiModels";
import {
  type WorkersAiBinding as RecipeAiBinding,
  workersAiResponseObject,
  workersAiResponseText,
} from "../../ai/workersAiResponses";

export type WebsiteImportInput = {
  url: string;
};

type WebsiteImportOptions = {
  ai?: RecipeAiBinding;
  fetcher?: typeof fetch;
};

const maxAiPageTextLength = 18_000;

export async function importRecipeFromWebsite(
  input: WebsiteImportInput,
  options: WebsiteImportOptions = {},
): Promise<Recipe> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(input.url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": `OpenCook/${appVersion} recipe data portability tool`,
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch recipe URL: ${response.status}`);
  }

  const html = await response.text();
  const structuredRecipe = findJsonLdRecipe(html);

  if (structuredRecipe) {
    return recipeFromSchemaOrg(structuredRecipe, input.url);
  }

  if (!options.ai) {
    throw new Error(
      "No schema.org Recipe JSON-LD found on the page, and Workers AI is not configured.",
    );
  }

  return recipeFromPageTextWithAi({
    ai: options.ai,
    html,
    model: workersAiModels.websiteImport,
    url: input.url,
  });
}

function recipeFromSchemaOrg(recipe: Record<string, unknown>, url: string) {
  return createRecipeRecord({
    title: stringField(recipe.name) ?? "Imported recipe",
    description: stringField(recipe.description),
    imageUrl: firstUrl(recipe.image, url),
    source: {
      name: hostname(url),
      url,
      importedAt: new Date().toISOString(),
      raw: recipe,
    },
    prepTimeMinutes: durationToMinutes(stringField(recipe.prepTime)),
    cookTimeMinutes: durationToMinutes(stringField(recipe.cookTime)),
    totalTimeMinutes: durationToMinutes(stringField(recipe.totalTime)),
    servings: stringField(recipe.recipeYield),
    tags: valuesToStrings(recipe.keywords),
    ingredients: valuesToStrings(recipe.recipeIngredient).map((text) => ({
      text,
    })),
    steps: valuesToStrings(recipe.recipeInstructions).map((text) => ({ text })),
  });
}

async function recipeFromPageTextWithAi({
  ai,
  html,
  model,
  url,
}: {
  ai: RecipeAiBinding;
  html: string;
  model: string;
  url: string;
}) {
  const pageText = readableTextFromHtml(html);

  if (!pageText) {
    throw new Error("No readable recipe text found on the page.");
  }

  const result = await ai.run(model, {
    max_completion_tokens: 1800,
    messages: [
      {
        role: "system",
        content:
          "You extract recipes from web page text. Return only valid JSON. Do not invent missing ingredients, steps, timings, images, servings, or notes.",
      },
      {
        role: "user",
        content: `Recipe page URL: ${url}

Return one JSON object with this shape:
{
  "title": "string",
  "description": "string or null",
  "imageUrl": "absolute or relative URL, or null",
  "prepTimeMinutes": number or null,
  "cookTimeMinutes": number or null,
  "totalTimeMinutes": number or null,
  "servings": "string or null",
  "tags": ["string"],
  "ingredients": ["string"],
  "steps": ["string"],
  "notes": ["string"]
}

If this is not a recipe page, return empty arrays for ingredients, steps, tags, and notes.

Page text:
${pageText}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        description: "Recipe fields extracted from readable web page text.",
        name: "WebsiteRecipeExtraction",
        schema: websiteRecipeExtractionJsonSchema,
        strict: false,
      },
    },
    temperature: 0.1,
  });

  const parsed =
    workersAiResponseObject(result) ??
    parseJsonObject(workersAiResponseText(result) ?? "");
  const recipeInput = recipeInputFromAi(parsed, html, model, url);

  if (!recipeInput) {
    throw new Error("Workers AI could not identify a recipe on the page.");
  }

  return createRecipeRecord(recipeInput);
}

function findJsonLdRecipe(html: string): Record<string, unknown> | undefined {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const match of scripts) {
    const text = match[1]?.trim();
    if (!text) {
      continue;
    }
    try {
      const parsed = JSON.parse(text);
      const recipe = findRecipeNode(parsed);
      if (recipe) {
        return recipe;
      }
    } catch {}
  }

  return undefined;
}

function findRecipeNode(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item);
      if (found) {
        return found;
      }
    }
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const type = value["@type"];
  if (
    type === "Recipe" ||
    (Array.isArray(type) && type.some((item) => item === "Recipe"))
  ) {
    return value;
  }

  return findRecipeNode(value["@graph"]);
}

function recipeInputFromAi(
  value: Record<string, unknown>,
  html: string,
  model: string,
  url: string,
) {
  const ingredients = lineStrings(value.ingredients).map((text) => ({ text }));
  const steps = lineStrings(value.steps).map((text) => ({ text }));

  if (!ingredients.length && !steps.length) {
    return undefined;
  }

  const title =
    firstString(value, ["title", "name"]) ?? extractTitle(html) ?? "Imported recipe";
  const imageUrl =
    firstString(value, ["imageUrl", "image", "photo"]) ?? firstPageImage(html);

  return {
    title,
    description: firstString(value, ["description"]),
    imageUrl: imageUrl ? absoluteUrl(imageUrl, url) : undefined,
    source: {
      name: hostname(url),
      url,
      importedAt: new Date().toISOString(),
      raw: {
        extraction: "workers-ai",
        model,
        recipe: value,
      },
    },
    prepTimeMinutes: minutesField(value.prepTimeMinutes),
    cookTimeMinutes: minutesField(value.cookTimeMinutes),
    totalTimeMinutes: minutesField(value.totalTimeMinutes),
    servings: firstString(value, ["servings", "yield", "recipeYield"]),
    tags: valuesToStrings(value.tags ?? value.keywords),
    ingredients,
    steps,
    notes: lineStrings(value.notes),
  };
}

function valuesToStrings(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (!isRecord(item)) {
          return undefined;
        }
        return stringField(item.text) ?? stringField(item.name);
      })
      .filter((item): item is string => Boolean(item));
  }
  return [];
}

function lineStrings(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return value.split(/\n+/).map(cleanRecipeLine).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return cleanRecipeLine(item);
        }
        if (!isRecord(item)) {
          return undefined;
        }
        return cleanRecipeLine(stringField(item.text) ?? stringField(item.name) ?? "");
      })
      .filter((item): item is string => Boolean(item));
  }
  return [];
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringField(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function minutesField(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    return durationToMinutes(value) ?? wordsToMinutes(value);
  }

  return undefined;
}

function firstUrl(value: unknown, baseUrl: string) {
  if (typeof value === "string") {
    return absoluteUrl(value, baseUrl);
  }
  if (Array.isArray(value)) {
    const found = value.find((item): item is string => typeof item === "string");
    return found ? absoluteUrl(found, baseUrl) : undefined;
  }
  if (isRecord(value)) {
    const url = stringField(value.url);
    return url ? absoluteUrl(url, baseUrl) : undefined;
  }
  return undefined;
}

function durationToMinutes(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const hourMatch = value.match(/(\d+)H/i);
  const minuteMatch = value.match(/(\d+)M/i);
  const hours = hourMatch?.[1] ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch?.[1] ? Number(minuteMatch[1]) : 0;
  return hours * 60 + minutes || undefined;
}

function wordsToMinutes(value: string) {
  const hours =
    value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i)?.[1] ??
    value.match(/(\d+(?:\.\d+)?)\s*:/)?.[1];
  const minutes =
    value.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i)?.[1] ??
    value.match(/:\s*(\d+)/)?.[1];
  const total = (hours ? Number(hours) * 60 : 0) + (minutes ? Number(minutes) : 0);

  if (total) {
    return Math.round(total);
  }

  const plainNumber = value.match(/\b(\d+)\b/)?.[1];
  return plainNumber ? Number(plainNumber) : undefined;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Website";
  }
}

function absoluteUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function readableTextFromHtml(html: string) {
  const title = extractTitle(html);
  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<(?:br|p|div|section|article|h[1-6]|tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );

  return [title ? `Page title: ${title}` : "", text]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, maxAiPageTextLength);
}

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtmlEntities(title.replace(/<[^>]+>/g, " ").trim()) : undefined;
}

function firstPageImage(html: string) {
  return (
    metaContent(html, "property", "og:image") ??
    metaContent(html, "name", "twitter:image") ??
    metaContent(html, "property", "twitter:image")
  );
}

function metaContent(html: string, attribute: string, value: string) {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${escapeRegExp(value)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  return stringField(decodeHtmlEntities(html.match(pattern)?.[1] ?? ""));
}

function parseJsonObject(text: string) {
  const jsonText = text.trim().startsWith("{")
    ? text.trim()
    : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);

  if (!jsonText?.startsWith("{")) {
    throw new Error("Workers AI returned invalid recipe JSON.");
  }

  const parsed = JSON.parse(jsonText) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Workers AI returned invalid recipe JSON.");
  }

  return parsed;
}

const nullableStringJsonSchema = { type: ["string", "null"] };
const nullableNumberJsonSchema = { type: ["number", "string", "null"] };
const stringArrayJsonSchema = { type: "array", items: { type: "string" } };

const websiteRecipeExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: nullableStringJsonSchema,
    description: nullableStringJsonSchema,
    imageUrl: nullableStringJsonSchema,
    prepTimeMinutes: nullableNumberJsonSchema,
    cookTimeMinutes: nullableNumberJsonSchema,
    totalTimeMinutes: nullableNumberJsonSchema,
    servings: nullableStringJsonSchema,
    tags: stringArrayJsonSchema,
    ingredients: stringArrayJsonSchema,
    steps: stringArrayJsonSchema,
    notes: stringArrayJsonSchema,
  },
  required: ["tags", "ingredients", "steps", "notes"],
} as const;

function cleanRecipeLine(value: string) {
  return value
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
