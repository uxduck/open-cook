import { createRecipeRecord, type Recipe } from "@open-cook/core";

export type WebsiteImportInput = {
  url: string;
};

export async function importRecipeFromWebsite(
  input: WebsiteImportInput,
  fetcher: typeof fetch = fetch,
): Promise<Recipe> {
  const response = await fetcher(input.url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "OpenCook/0.1 recipe data portability tool",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch recipe URL: ${response.status}`);
  }

  const html = await response.text();
  const recipe = findJsonLdRecipe(html);

  if (!recipe) {
    throw new Error("No schema.org Recipe JSON-LD found on the page.");
  }

  return createRecipeRecord({
    title: stringField(recipe.name) ?? "Imported recipe",
    description: stringField(recipe.description),
    imageUrl: firstUrl(recipe.image, input.url),
    source: {
      name: hostname(input.url),
      url: input.url,
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

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
