import {
  type FoodPreferences,
  type Recipe,
  recipeSearchText,
} from "@open-cook/core";

export type RecipeRecommendationContext = {
  dietary?: string;
  guestQuestion?: string;
  prompt?: string;
  query?: string;
  title?: string;
};

export type RecipeRecommendationProvider = {
  provider: "deterministic" | "workers-ai";
  model?: string;
};

export type RecipeRecommendation = {
  id: string;
  title: string;
  score: number;
  reasons: string[];
};

export type RankedRecipeRecommendation = RecipeRecommendation & {
  recipe: Recipe;
};

export type RejectedRecipeRecommendation = {
  id: string;
  title: string;
  reasons: string[];
};

export type RecipeRecommendationResult = {
  recipeIds: string[];
  recommendations: RecipeRecommendation[];
  rejectedCount: number;
  warnings: string[];
  provider: RecipeRecommendationProvider;
};

export type DeterministicRecipeRecommendationResult = RecipeRecommendationResult & {
  candidates: RankedRecipeRecommendation[];
  rejected: RejectedRecipeRecommendation[];
};

export const defaultRecipeRecommendationCount = 4;
export const maxRecipeRecommendationCount = 8;
export const maxAiRecipeRecommendationCandidates = 30;

const stopWords = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "for",
  "from",
  "make",
  "or",
  "the",
  "to",
  "us",
  "what",
  "with",
  "you",
]);

const constraintAliases: Record<string, string[]> = {
  alcohol: ["alcohol", "beer", "wine", "whisky", "whiskey", "rum", "vodka"],
  dairy: [
    "dairy",
    "milk",
    "cheese",
    "butter",
    "cream",
    "yogurt",
    "yoghurt",
    "whey",
    "ghee",
    "paneer",
  ],
  eggs: ["egg", "eggs", "mayonnaise", "mayo"],
  fish: ["fish", "anchovy", "cod", "haddock", "mackerel", "salmon", "sardine", "tuna"],
  gluten: [
    "gluten",
    "wheat",
    "barley",
    "bread",
    "breadcrumbs",
    "flour",
    "pasta",
    "rye",
    "seitan",
    "soy sauce",
  ],
  peanuts: ["peanut", "peanuts", "groundnut", "groundnuts"],
  pork: ["pork", "bacon", "ham", "prosciutto", "chorizo", "lard", "pancetta"],
  sesame: ["sesame", "tahini"],
  shellfish: [
    "shellfish",
    "clam",
    "clams",
    "crab",
    "crayfish",
    "lobster",
    "mussel",
    "mussels",
    "oyster",
    "oysters",
    "prawn",
    "prawns",
    "scallop",
    "scallops",
    "shrimp",
  ],
  soy: ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "soy sauce"],
  "tree nuts": [
    "tree nuts",
    "almond",
    "almonds",
    "cashew",
    "cashews",
    "hazelnut",
    "hazelnuts",
    "macadamia",
    "pecan",
    "pecans",
    "pistachio",
    "pistachios",
    "walnut",
    "walnuts",
  ],
};

const meatTerms = [
  "beef",
  "chicken",
  "duck",
  "goat",
  "ham",
  "lamb",
  "meat",
  "pork",
  "prosciutto",
  "sausage",
  "turkey",
  "veal",
];

const fishAndShellfishTerms = [
  ...(constraintAliases.fish ?? []),
  ...(constraintAliases.shellfish ?? []),
];

const vegetarianBlockedTerms = [...meatTerms, ...fishAndShellfishTerms];
const pescatarianBlockedTerms = meatTerms;
const veganBlockedTerms = [
  ...vegetarianBlockedTerms,
  ...(constraintAliases.dairy ?? []),
  ...(constraintAliases.eggs ?? []),
  "honey",
];

type ScoreAccumulator = {
  score: number;
  reasons: string[];
};

export function normalizeRecipeRecommendationCount(count?: number) {
  if (count === undefined) return defaultRecipeRecommendationCount;
  return Math.min(
    Math.max(Math.trunc(count), 1),
    maxRecipeRecommendationCount,
  );
}

export function recommendRecipesDeterministically(input: {
  context?: RecipeRecommendationContext;
  count?: number;
  preferences?: FoodPreferences | null;
  recipes: Recipe[];
}): DeterministicRecipeRecommendationResult {
  const count = normalizeRecipeRecommendationCount(input.count);
  const ranked: RankedRecipeRecommendation[] = [];
  const rejected: RejectedRecipeRecommendation[] = [];

  for (const recipe of input.recipes) {
    const text = normalizedRecipeText(recipe);
    const rejectReasons = hardRejectReasons(recipe, text, input.preferences);
    if (rejectReasons.length) {
      rejected.push({
        id: recipe.id,
        title: recipe.title,
        reasons: rejectReasons.slice(0, 3),
      });
      continue;
    }

    const score = scoreRecipeForRecommendation(
      recipe,
      text,
      input.preferences,
      input.context,
    );
    ranked.push({
      id: recipe.id,
      recipe,
      reasons: score.reasons.length ? score.reasons.slice(0, 4) : ["Fits the menu"],
      score: score.score,
      title: recipe.title,
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  const recommendations = ranked.slice(0, count).map(stripRecipeFromRecommendation);
  return {
    candidates: ranked,
    provider: { provider: "deterministic" },
    recipeIds: recommendations.map((recommendation) => recommendation.id),
    recommendations,
    rejected,
    rejectedCount: rejected.length,
    warnings: recommendationWarnings(rejected.length, input.preferences),
  };
}

export function stripRecipeFromRecommendation(
  recommendation: RankedRecipeRecommendation,
): RecipeRecommendation {
  return {
    id: recommendation.id,
    reasons: recommendation.reasons,
    score: recommendation.score,
    title: recommendation.title,
  };
}

export function compactRecipeRecommendationCandidate(
  candidate: RankedRecipeRecommendation,
) {
  const recipe = candidate.recipe;
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    tags: recipe.tags.slice(0, 10),
    servings: recipe.servings,
    totalTimeMinutes: recipe.totalTimeMinutes,
    ingredients: recipe.ingredients
      .map((ingredient) => ingredient.text)
      .slice(0, 12),
    reasons: candidate.reasons,
  };
}

function hardRejectReasons(
  recipe: Recipe,
  text: string,
  preferences?: FoodPreferences | null,
) {
  if (!preferences) return [];

  const reasons: string[] = [];
  for (const allergy of preferences.allergies) {
    if (matchesAnyTerm(text, constraintTermsFor(allergy))) {
      reasons.push(`Matches allergy: ${allergy}`);
    }
  }
  for (const avoidedIngredient of preferences.avoidedIngredients) {
    if (matchesAnyTerm(text, constraintTermsFor(avoidedIngredient))) {
      reasons.push(`Contains avoided ingredient: ${avoidedIngredient}`);
    }
  }
  for (const dietaryNeed of preferences.dietaryNeeds) {
    const terms = hardConstraintTermsForDietaryNeed(dietaryNeed);
    if (terms.length && matchesAnyTerm(text, terms)) {
      reasons.push(`Conflicts with ${dietaryNeed}`);
    }
  }

  const dietTerms = blockedTermsForDietPattern(preferences.dietPattern);
  if (dietTerms.length && matchesAnyTerm(text, dietTerms)) {
    reasons.push(`Conflicts with ${preferences.dietPattern} preference`);
  }

  if (
    recipe.totalTimeMinutes !== undefined &&
    recipe.totalTimeMinutes > preferences.maxCookTimeMinutes
  ) {
    reasons.push(`Takes over ${preferences.maxCookTimeMinutes} minutes`);
  }

  return uniqueStrings(reasons);
}

function scoreRecipeForRecommendation(
  recipe: Recipe,
  text: string,
  preferences?: FoodPreferences | null,
  context: RecipeRecommendationContext = {},
): ScoreAccumulator {
  const result: ScoreAccumulator = { score: 0, reasons: [] };

  addContextScore(result, text, context.query, 90, "Matches your search");
  addContextScore(result, text, context.title, 35, "Fits the gathering title");
  addContextScore(result, text, context.prompt, 45, "Fits the gathering note");
  addContextScore(result, text, context.dietary, 50, "Fits the dietary notes");

  if (!preferences) {
    return result;
  }

  if (
    recipe.totalTimeMinutes !== undefined &&
    recipe.totalTimeMinutes <= preferences.maxCookTimeMinutes
  ) {
    addScore(result, 20, `Fits ${preferences.maxCookTimeMinutes} minute limit`);
  }

  for (const ingredient of preferences.favoriteIngredients) {
    if (matchesAnyTerm(text, constraintTermsFor(ingredient))) {
      addScore(result, 55, `Uses favorite ingredient: ${ingredient}`);
    }
  }

  for (const cuisine of preferences.favoriteCuisines) {
    if (matchesTextIntent(text, cuisine)) {
      addScore(result, 45, `Matches favorite cuisine: ${cuisine}`);
    }
  }

  for (const dietaryNeed of preferences.dietaryNeeds) {
    if (matchesTextIntent(text, dietaryNeed)) {
      addScore(result, 20, `Mentions ${dietaryNeed}`);
    }
  }

  for (const goal of preferences.cookingGoals) {
    addCookingGoalScore(result, recipe, text, goal);
  }

  for (const equipment of preferences.equipment) {
    if (matchesTextIntent(text, equipment)) {
      addScore(result, 12, `Uses available equipment: ${equipment}`);
    }
  }

  addSkillScore(result, recipe, preferences.skillLevel);
  addSpiceScore(result, text, preferences.spiceLevel);
  addHouseholdScore(result, recipe, preferences.householdSize);

  return result;
}

function addContextScore(
  result: ScoreAccumulator,
  text: string,
  value: string | undefined,
  weight: number,
  reason: string,
) {
  const normalized = normalizeText(value);
  if (!normalized) return;

  if (containsTerm(text, normalized)) {
    addScore(result, weight, reason);
    return;
  }

  const terms = searchTerms(normalized);
  const matches = terms.filter((term) => containsTerm(text, term)).length;
  if (matches > 0) {
    addScore(result, Math.min(weight - 5, matches * 12), reason);
  }
}

function addCookingGoalScore(
  result: ScoreAccumulator,
  recipe: Recipe,
  text: string,
  goal: string,
) {
  const normalizedGoal = normalizeText(goal);
  if (!normalizedGoal) return;

  if (matchesTextIntent(text, normalizedGoal)) {
    addScore(result, 28, `Matches goal: ${goal}`);
    return;
  }

  if (
    normalizedGoal.includes("quick") &&
    recipe.totalTimeMinutes !== undefined &&
    recipe.totalTimeMinutes <= 30
  ) {
    addScore(result, 35, "Good quick option");
    return;
  }

  const goalTerms: Record<string, string[]> = {
    "batch cooking": ["batch", "freezer", "leftover", "meal prep", "stew", "soup"],
    "budget-friendly": ["beans", "lentils", "pasta", "potato", "rice"],
    "comfort food": ["bake", "casserole", "comfort", "pasta", "stew"],
    "family-friendly": ["child", "children", "family", "kid", "kids"],
    healthy: ["greens", "healthy", "salad", "vegetable", "vegetables"],
    "high protein": ["beans", "chicken", "fish", "lentils", "protein", "tofu"],
    "low waste": ["leftover", "leftovers", "scraps", "zero waste"],
  };

  const terms = goalTerms[normalizedGoal] ?? [];
  if (terms.length && matchesAnyTerm(text, terms)) {
    addScore(result, 28, `Matches goal: ${goal}`);
  }
}

function addSkillScore(
  result: ScoreAccumulator,
  recipe: Recipe,
  skillLevel: FoodPreferences["skillLevel"],
) {
  if (skillLevel !== "beginner") return;

  const ingredientCount = recipe.ingredients.length;
  const stepCount = recipe.steps.length;
  if (ingredientCount <= 10 && stepCount <= 6) {
    addScore(result, 18, "Beginner-friendly");
  }
}

function addSpiceScore(
  result: ScoreAccumulator,
  text: string,
  spiceLevel: FoodPreferences["spiceLevel"],
) {
  const spicyTerms = ["cayenne", "chile", "chili", "chilli", "hot sauce", "jalapeno", "spicy"];
  const isSpicy = matchesAnyTerm(text, spicyTerms);
  if (!isSpicy) return;

  if (spiceLevel === "hot" || spiceLevel === "very-hot") {
    addScore(result, 16, "Matches spice preference");
  } else if (spiceLevel === "mild") {
    result.score -= 20;
  }
}

function addHouseholdScore(
  result: ScoreAccumulator,
  recipe: Recipe,
  householdSize: number,
) {
  const servings = firstNumber(recipe.servings);
  if (servings !== undefined && servings >= householdSize) {
    addScore(result, 8, "Serves the household");
  }
}

function addScore(result: ScoreAccumulator, amount: number, reason: string) {
  result.score += amount;
  if (!result.reasons.includes(reason)) {
    result.reasons.push(reason);
  }
}

function hardConstraintTermsForDietaryNeed(value: string) {
  const normalized = normalizeText(value);
  if (normalized.includes("gluten-free")) return constraintAliases.gluten ?? [];
  if (normalized.includes("dairy-free")) return constraintAliases.dairy ?? [];
  if (normalized.includes("halal")) {
    return [
      ...(constraintAliases.pork ?? []),
      ...(constraintAliases.alcohol ?? []),
    ];
  }
  if (normalized.includes("kosher")) {
    return [
      ...(constraintAliases.pork ?? []),
      ...(constraintAliases.shellfish ?? []),
    ];
  }
  return [];
}

function blockedTermsForDietPattern(pattern: FoodPreferences["dietPattern"]) {
  if (pattern === "vegetarian") return vegetarianBlockedTerms;
  if (pattern === "vegan") return veganBlockedTerms;
  if (pattern === "pescatarian") return pescatarianBlockedTerms;
  return [];
}

function constraintTermsFor(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const terms = new Set<string>();
  terms.add(normalized);
  for (const [key, aliases] of Object.entries(constraintAliases)) {
    if (normalized.includes(key) || aliases.some((alias) => normalized.includes(alias))) {
      for (const alias of aliases) {
        terms.add(alias);
      }
    }
  }
  return [...terms];
}

function matchesTextIntent(text: string, value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return containsTerm(text, normalized) || searchTerms(normalized).some((term) => containsTerm(text, term));
}

function matchesAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => containsTerm(text, term));
}

function containsTerm(text: string, term: string) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  const pattern = normalizedTerm
    .split(" ")
    .map(escapeRegExp)
    .join("\\s+");
  return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, "i").test(text);
}

function searchTerms(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function normalizedRecipeText(recipe: Recipe) {
  return normalizeText(recipeSearchText(recipe));
}

function normalizeText(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

function firstNumber(value?: string) {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function recommendationWarnings(
  rejectedCount: number,
  preferences?: FoodPreferences | null,
) {
  if (!preferences || rejectedCount === 0) return [];
  return [`Skipped ${rejectedCount} recipe${rejectedCount === 1 ? "" : "s"} that looked incompatible with saved preferences.`];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
