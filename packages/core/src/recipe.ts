import * as v from "valibot";

export const recipeSourceSchema = v.object({
  name: v.optional(v.string()),
  url: v.optional(v.pipe(v.string(), v.url())),
  externalId: v.optional(v.string()),
  importedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  raw: v.optional(v.record(v.string(), v.unknown())),
});

export const recipeIngredientSchema = v.object({
  section: v.optional(v.string()),
  text: v.pipe(v.string(), v.minLength(1)),
});

export const recipeStepSchema = v.object({
  section: v.optional(v.string()),
  text: v.pipe(v.string(), v.minLength(1)),
});

export const recipeSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.pipe(v.string(), v.url())),
  source: v.optional(recipeSourceSchema),
  prepTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  cookTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  totalTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  servings: v.optional(v.string()),
  tags: v.array(v.string()),
  ingredients: v.array(recipeIngredientSchema),
  steps: v.array(recipeStepSchema),
  notes: v.array(v.string()),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const createRecipeSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.pipe(v.string(), v.url())),
  source: v.optional(recipeSourceSchema),
  prepTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  cookTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  totalTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  servings: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  ingredients: v.optional(v.array(recipeIngredientSchema)),
  steps: v.optional(v.array(recipeStepSchema)),
  notes: v.optional(v.array(v.string())),
});

export const updateRecipeSchema = v.partial(createRecipeSchema);

export const recipeListQuerySchema = v.object({
  q: v.optional(v.string()),
  tag: v.optional(v.string()),
  source: v.optional(v.string()),
});

export const recipeIdParamSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
});

export type Recipe = v.InferOutput<typeof recipeSchema>;
export type RecipeSource = v.InferOutput<typeof recipeSourceSchema>;
export type RecipeIngredient = v.InferOutput<typeof recipeIngredientSchema>;
export type RecipeStep = v.InferOutput<typeof recipeStepSchema>;
export type CreateRecipeInput = v.InferInput<typeof createRecipeSchema>;
export type UpdateRecipeInput = v.InferInput<typeof updateRecipeSchema>;

export function nowIso() {
  return new Date().toISOString();
}

export function createRecipeRecord(input: CreateRecipeInput): Recipe {
  const timestamp = nowIso();

  return {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    source: input.source,
    prepTimeMinutes: input.prepTimeMinutes,
    cookTimeMinutes: input.cookTimeMinutes,
    totalTimeMinutes: input.totalTimeMinutes,
    servings: input.servings,
    tags: input.tags ?? [],
    ingredients: input.ingredients ?? [],
    steps: input.steps ?? [],
    notes: input.notes ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateRecipeRecord(recipe: Recipe, input: UpdateRecipeInput): Recipe {
  return {
    ...recipe,
    ...input,
    tags: input.tags ?? recipe.tags,
    ingredients: input.ingredients ?? recipe.ingredients,
    steps: input.steps ?? recipe.steps,
    notes: input.notes ?? recipe.notes,
    updatedAt: nowIso(),
  };
}

export function recipeSearchText(recipe: Recipe) {
  return [
    recipe.title,
    recipe.description,
    recipe.source?.name,
    recipe.source?.url,
    ...recipe.tags,
    ...recipe.ingredients.map((ingredient) => ingredient.text),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
