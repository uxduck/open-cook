import type { Recipe } from "@open-cook/core";

export type RecipeSearchInput = {
  q?: string;
  tag?: string;
  source?: string;
  limit?: number;
  includeIngredients?: boolean;
  includeSteps?: boolean;
};

export type RecipeSearchSummary = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  servings?: string;
  totalTimeMinutes?: number;
  tags: string[];
  source?: {
    name?: string;
    url?: string;
    externalId?: string;
  };
  matchedFields: string[];
  ingredientMatches: string[];
  score: number;
  ingredients?: string[];
  steps?: string[];
};

export type RecipeSearchOutput = {
  query: {
    q?: string;
    tag?: string;
    source?: string;
    limit: number;
  };
  count: number;
  returned: number;
  recipes: RecipeSearchSummary[];
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const PREVIEW_LIMIT = 6;

export function searchRecipeSummaries(
  recipes: Recipe[],
  input: RecipeSearchInput = {},
): RecipeSearchOutput {
  const query = normalizeSearchInput(input);
  const summarized = recipes.map((recipe) =>
    summarizeRecipeSearchResult(recipe, query),
  );
  const ranked = (
    query.q ? summarized.filter((recipe) => recipe.score > 0) : summarized
  ).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });
  const limited = ranked.slice(0, query.limit);

  return {
    query: {
      ...(query.q ? { q: query.q } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
      ...(query.source ? { source: query.source } : {}),
      limit: query.limit,
    },
    count: ranked.length,
    returned: limited.length,
    recipes: limited,
  };
}

function normalizeSearchInput(input: RecipeSearchInput) {
  return {
    q: input.q?.trim(),
    tag: input.tag?.trim(),
    source: input.source?.trim(),
    limit: Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT),
    includeIngredients: Boolean(input.includeIngredients),
    includeSteps: Boolean(input.includeSteps),
  };
}

function summarizeRecipeSearchResult(
  recipe: Recipe,
  input: ReturnType<typeof normalizeSearchInput>,
): RecipeSearchSummary {
  const score = scoreRecipe(recipe, input.q);
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    servings: recipe.servings,
    totalTimeMinutes: recipe.totalTimeMinutes,
    tags: recipe.tags,
    source: cleanSource(recipe),
    matchedFields: score.matchedFields,
    ingredientMatches: matchingLines(
      recipe.ingredients.map((ingredient) => ingredient.text),
      input.q,
    ),
    score: score.value,
    ...(input.includeIngredients
      ? {
          ingredients: recipe.ingredients
            .map((ingredient) => ingredient.text)
            .slice(0, PREVIEW_LIMIT),
        }
      : {}),
    ...(input.includeSteps
      ? { steps: recipe.steps.map((step) => step.text).slice(0, PREVIEW_LIMIT) }
      : {}),
  };
}

function cleanSource(recipe: Recipe) {
  if (!recipe.source) return undefined;
  const source = {
    name: recipe.source.name,
    url: recipe.source.url,
    externalId: recipe.source.externalId,
  };
  return Object.values(source).some(Boolean) ? source : undefined;
}

function scoreRecipe(recipe: Recipe, query?: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { value: 0, matchedFields: [] };
  }

  let value = 0;
  const matchedFields = new Set<string>();
  const fields = [
    { name: "title", text: recipe.title, phraseWeight: 100, termWeight: 20 },
    {
      name: "description",
      text: recipe.description,
      phraseWeight: 45,
      termWeight: 8,
    },
    {
      name: "tags",
      text: recipe.tags.join(" "),
      phraseWeight: 55,
      termWeight: 12,
    },
    {
      name: "ingredients",
      text: recipe.ingredients.map((ingredient) => ingredient.text).join(" "),
      phraseWeight: 35,
      termWeight: 7,
    },
    {
      name: "steps",
      text: recipe.steps.map((step) => step.text).join(" "),
      phraseWeight: 20,
      termWeight: 4,
    },
    { name: "notes", text: recipe.notes.join(" "), phraseWeight: 15, termWeight: 3 },
    {
      name: "source",
      text: [recipe.source?.name, recipe.source?.url].filter(Boolean).join(" "),
      phraseWeight: 12,
      termWeight: 2,
    },
  ];
  const terms = normalizedQuery.split(" ").filter(Boolean);

  for (const field of fields) {
    const text = normalizeText(field.text);
    if (!text) continue;
    let fieldMatched = false;

    if (text.includes(normalizedQuery)) {
      value += field.phraseWeight;
      fieldMatched = true;
    }

    for (const term of terms) {
      if (text.includes(term)) {
        value += field.termWeight;
        fieldMatched = true;
      }
    }

    if (fieldMatched) {
      matchedFields.add(field.name);
    }
  }

  return { value, matchedFields: [...matchedFields] };
}

function matchingLines(lines: string[], query?: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const terms = normalizedQuery.split(" ").filter(Boolean);
  return lines
    .filter((line) => {
      const text = normalizeText(line);
      return (
        text.includes(normalizedQuery) || terms.some((term) => text.includes(term))
      );
    })
    .slice(0, PREVIEW_LIMIT);
}

function normalizeText(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}
