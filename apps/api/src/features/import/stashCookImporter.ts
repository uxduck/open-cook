import {
  type CreateRecipeInput,
  createRecipeRecord,
  nowIso,
  type Recipe,
} from "@open-cook/core";

export type StashCookImportInput = {
  baseUrl?: string;
  bearerToken?: string;
  cookie?: string;
  take?: number;
  includeDeleted?: boolean;
};

type StashCookPage = {
  results?: unknown[];
  totalCount?: number;
};

const defaultBaseUrl = "https://api.stashcook.com";
const detailExpand = "Ingredients,Method,Notes,Nutrition";

export async function importStashCookRecipes(
  input: StashCookImportInput,
  fetcher: typeof fetch = fetch,
): Promise<Recipe[]> {
  const baseUrl = input.baseUrl ?? defaultBaseUrl;
  const take = input.take ?? 100;
  const headers = buildStashCookHeaders(input);

  if (!headers.Authorization && !headers.Cookie) {
    throw new Error(
      "Provide a StashCook bearer token or cookie from your own session.",
    );
  }

  const listRows: Record<string, unknown>[] = [];
  let skip = 0;

  for (;;) {
    const url = new URL("/recipes", baseUrl);
    url.searchParams.set("sortBy", "name");
    url.searchParams.set("direction", "asc");
    url.searchParams.set("skip", String(skip));
    url.searchParams.set("take", String(take));
    url.searchParams.set("expand", detailExpand);
    if (input.includeDeleted) {
      url.searchParams.set("deleted", "true");
    }

    const page = await stashCookJson<StashCookPage | unknown[]>(url, headers, fetcher);
    const rows = Array.isArray(page) ? page : (page.results ?? []);
    listRows.push(...rows.filter(isObjectRecord));

    if (rows.length < take) {
      break;
    }
    skip += rows.length;
  }

  const detailedRows = await Promise.all(
    listRows.map(async (row) => {
      if (hasRecipeDetail(row)) {
        return row;
      }
      const id = firstString(row, ["id", "recipeId"]);
      if (!id) {
        return row;
      }
      try {
        const detailUrl = new URL(`/recipes/${id}`, baseUrl);
        detailUrl.searchParams.set("expand", detailExpand);
        return await stashCookJson<Record<string, unknown>>(
          detailUrl,
          headers,
          fetcher,
        );
      } catch {
        return row;
      }
    }),
  );

  return detailedRows.map(mapStashCookRecipe);
}

function buildStashCookHeaders(input: StashCookImportInput): Record<string, string> {
  return {
    Accept: "application/json",
    "Accept-Language": "en-GB",
    "api-version": "2025.01.06",
    ...(input.bearerToken
      ? { Authorization: `Bearer ${input.bearerToken.replace(/^Bearer\s+/i, "")}` }
      : {}),
    ...(input.cookie ? { Cookie: input.cookie } : {}),
  };
}

async function stashCookJson<T>(
  url: URL,
  headers: Record<string, string>,
  fetcher: typeof fetch,
): Promise<T> {
  const response = await fetcher(url.toString(), {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      `StashCook request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

function mapStashCookRecipe(row: Record<string, unknown>): Recipe {
  const externalId = firstString(row, ["id", "recipeId", "externalId"]);
  const input: CreateRecipeInput = {
    title: firstString(row, ["name", "title"]) ?? "Untitled StashCook recipe",
    description: firstString(row, ["description", "summary"]),
    imageUrl: firstString(row, [
      "imageUrl",
      "primaryImageUrl",
      "thumbnailUrl",
      "photoUrl",
    ]),
    source: {
      name: "StashCook",
      externalId,
      url: firstString(row, ["sourceUrl", "url", "originalUrl", "websiteUrl"]),
      importedAt: nowIso(),
      raw: row,
    },
    prepTimeMinutes: firstNumber(row, ["prepTimeMinutes", "preparationMinutes"]),
    cookTimeMinutes: firstNumber(row, ["cookTimeMinutes", "cookingMinutes"]),
    totalTimeMinutes: firstNumber(row, ["totalTimeMinutes", "totalMinutes"]),
    servings: firstString(row, ["servings", "servingSize", "yield"]),
    tags: stringsFromUnknown(
      firstValue(row, ["tags", "recipeTags", "categories", "keywords"]),
    ),
    ingredients: toTextRows(
      firstValue(row, ["ingredients", "recipeIngredients", "ingredients2"]),
    ),
    steps: toTextRows(firstValue(row, ["method", "steps", "directions"])),
    notes: stringsFromUnknown(firstValue(row, ["notes", "recipeNotes"])),
  };

  return {
    ...createRecipeRecord(input),
    id: externalId ? `stashcook-${externalId}` : crypto.randomUUID(),
  };
}

function hasRecipeDetail(row: Record<string, unknown>) {
  return Boolean(
    firstValue(row, ["ingredients", "recipeIngredients", "method", "steps"]),
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function firstString(row: Record<string, unknown>, keys: string[]) {
  const value = firstValue(row, keys);
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function firstNumber(row: Record<string, unknown>, keys: string[]) {
  const value = firstValue(row, keys);
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function stringsFromUnknown(value: unknown): string[] {
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
        if (isObjectRecord(item)) {
          return firstString(item, ["name", "title", "text", "value"]);
        }
        return undefined;
      })
      .filter((item): item is string => Boolean(item));
  }
  return [];
}

function toTextRows(value: unknown): { section?: string; text: string }[] {
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

  return value
    .map((item) => {
      if (typeof item === "string") {
        return { text: item };
      }
      if (!isObjectRecord(item)) {
        return undefined;
      }
      const section = firstString(item, ["section", "heading", "group"]);
      const text =
        firstString(item, ["text", "description", "instruction", "name"]) ??
        ingredientObjectToText(item);
      return text ? { section, text } : undefined;
    })
    .filter((item): item is { section?: string; text: string } => Boolean(item));
}

function ingredientObjectToText(item: Record<string, unknown>) {
  const quantity = firstString(item, ["quantity", "amount"]);
  const unit = firstString(item, ["unit", "unitName"]);
  const product = firstString(item, ["productName", "ingredientName", "name"]);
  return [quantity, unit, product].filter(Boolean).join(" ").trim() || undefined;
}
