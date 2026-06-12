import * as v from "valibot";

export const recipeSourceSchema = v.object({
  name: v.optional(v.string()),
  url: v.optional(v.pipe(v.string(), v.url())),
  externalId: v.optional(v.string()),
  importedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  raw: v.optional(v.record(v.string(), v.unknown())),
});

export const recipeQuantitySchema = v.object({
  value: v.optional(v.pipe(v.number(), v.minValue(0))),
  valueText: v.optional(v.string()),
  unit: v.optional(v.string()),
});

export const recipeIngredientSchema = v.object({
  id: v.optional(v.string()),
  section: v.optional(v.string()),
  text: v.pipe(v.string(), v.minLength(1)),
  quantity: v.optional(recipeQuantitySchema),
  item: v.optional(v.string()),
  preparation: v.optional(v.string()),
  note: v.optional(v.string()),
  scalable: v.optional(v.boolean()),
  confidence: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  warnings: v.optional(v.array(v.string())),
});

export const recipeStepSchema = v.object({
  id: v.optional(v.string()),
  section: v.optional(v.string()),
  text: v.pipe(v.string(), v.minLength(1)),
  ingredientIds: v.optional(v.array(v.string())),
  timers: v.optional(
    v.array(
      v.object({
        label: v.optional(v.string()),
        minutes: v.pipe(v.number(), v.minValue(0)),
      }),
    ),
  ),
  temperature: v.optional(
    v.object({
      value: v.pipe(v.number(), v.minValue(0)),
      unit: v.picklist(["C", "F"]),
    }),
  ),
  equipment: v.optional(v.array(v.string())),
  confidence: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  warnings: v.optional(v.array(v.string())),
});

export const recipeVisibilitySchema = v.picklist(["private", "unlisted", "public"]);

export const recipeImageSchema = v.object({
  url: v.pipe(v.string(), v.url()),
  alt: v.optional(v.string()),
  width: v.optional(v.pipe(v.number(), v.minValue(0))),
  height: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export const recipeSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string()),
  // Cover image, kept in sync with images[0] for backwards compatibility.
  imageUrl: v.optional(v.pipe(v.string(), v.url())),
  images: v.optional(v.array(recipeImageSchema)),
  source: v.optional(recipeSourceSchema),
  prepTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  cookTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  totalTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  servings: v.optional(v.string()),
  tags: v.array(v.string()),
  ingredients: v.array(recipeIngredientSchema),
  steps: v.array(recipeStepSchema),
  notes: v.array(v.string()),
  visibility: v.optional(recipeVisibilitySchema),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const recipeOwnerSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.string(),
  username: v.optional(v.string()),
});

export const sharedRecipeSchema = v.object({
  ...recipeSchema.entries,
  owner: recipeOwnerSchema,
  sharedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  seenAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  dismissedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  copiedRecipeId: v.optional(v.pipe(v.string(), v.minLength(1))),
});

export const recipeShareSchema = v.object({
  recipeId: v.pipe(v.string(), v.minLength(1)),
  sharedWith: recipeOwnerSchema,
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  seenAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  dismissedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  copiedRecipeId: v.optional(v.pipe(v.string(), v.minLength(1))),
});

export const recipeCookProgressInputSchema = v.object({
  checkedIngredientIds: v.array(v.pipe(v.string(), v.minLength(1))),
  checkedStepIds: v.array(v.pipe(v.string(), v.minLength(1))),
});

export const recipeCookProgressSchema = v.object({
  recipeId: v.pipe(v.string(), v.minLength(1)),
  ...recipeCookProgressInputSchema.entries,
});

export const createRecipeSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.pipe(v.string(), v.url())),
  images: v.optional(v.array(recipeImageSchema)),
  source: v.optional(recipeSourceSchema),
  prepTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  cookTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  totalTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  servings: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  ingredients: v.optional(v.array(recipeIngredientSchema)),
  steps: v.optional(v.array(recipeStepSchema)),
  notes: v.optional(v.array(v.string())),
  visibility: v.optional(recipeVisibilitySchema),
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
export type RecipeImage = v.InferOutput<typeof recipeImageSchema>;
export type RecipeVisibility = v.InferOutput<typeof recipeVisibilitySchema>;
export type RecipeOwner = v.InferOutput<typeof recipeOwnerSchema>;
export type SharedRecipe = v.InferOutput<typeof sharedRecipeSchema>;
export type RecipeShare = v.InferOutput<typeof recipeShareSchema>;
export type RecipeCookProgress = v.InferOutput<typeof recipeCookProgressSchema>;
export type RecipeSource = v.InferOutput<typeof recipeSourceSchema>;
export type RecipeQuantity = v.InferOutput<typeof recipeQuantitySchema>;
export type RecipeIngredient = v.InferOutput<typeof recipeIngredientSchema>;
export type RecipeStep = v.InferOutput<typeof recipeStepSchema>;
export type CreateRecipeInput = v.InferInput<typeof createRecipeSchema>;
export type UpdateRecipeInput = v.InferInput<typeof updateRecipeSchema>;
export type RecipeCookProgressInput = v.InferInput<
  typeof recipeCookProgressInputSchema
>;

export function nowIso() {
  return new Date().toISOString();
}

/**
 * Build the canonical, de-duplicated image gallery for a recipe. The legacy
 * single `imageUrl` is folded in as the cover when no gallery is provided, so
 * imports and older clients keep working transparently.
 */
export function normalizeRecipeImages(
  images?: RecipeImage[],
  imageUrl?: string,
): RecipeImage[] {
  const list: RecipeImage[] = images ? [...images] : [];
  if (list.length === 0 && imageUrl) {
    list.push({ url: imageUrl });
  }

  const seen = new Set<string>();
  return list.filter((image) => {
    if (!image?.url || seen.has(image.url)) {
      return false;
    }
    seen.add(image.url);
    return true;
  });
}

export function createRecipeRecord(input: CreateRecipeInput): Recipe {
  const timestamp = nowIso();
  const images = normalizeRecipeImages(input.images, input.imageUrl);

  return decodeRecipeText({
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    imageUrl: images[0]?.url ?? input.imageUrl,
    images,
    source: input.source,
    prepTimeMinutes: input.prepTimeMinutes,
    cookTimeMinutes: input.cookTimeMinutes,
    totalTimeMinutes: input.totalTimeMinutes,
    servings: input.servings,
    tags: input.tags ?? [],
    ingredients: input.ingredients ?? [],
    steps: input.steps ?? [],
    notes: input.notes ?? [],
    visibility: input.visibility ?? "private",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function updateRecipeRecord(recipe: Recipe, input: UpdateRecipeInput): Recipe {
  // A gallery edit is authoritative; a legacy imageUrl-only edit replaces the
  // cover; otherwise the existing gallery is preserved untouched.
  const images =
    input.images !== undefined
      ? normalizeRecipeImages(input.images)
      : input.imageUrl !== undefined
        ? normalizeRecipeImages(undefined, input.imageUrl)
        : recipe.images;

  return decodeRecipeText({
    ...recipe,
    ...input,
    images,
    imageUrl: images?.[0]?.url ?? input.imageUrl ?? recipe.imageUrl,
    tags: input.tags ?? recipe.tags,
    ingredients: input.ingredients ?? recipe.ingredients,
    steps: input.steps ?? recipe.steps,
    notes: input.notes ?? recipe.notes,
    updatedAt: nowIso(),
  });
}

export function recipeSearchText(recipe: Recipe) {
  const decodedRecipe = decodeRecipeText(recipe);

  return [
    decodedRecipe.title,
    decodedRecipe.description,
    decodedRecipe.source?.name,
    decodedRecipe.source?.url,
    ...decodedRecipe.tags,
    ...decodedRecipe.ingredients.map((ingredient) => ingredient.text),
    ...decodedRecipe.ingredients.map((ingredient) => ingredient.note),
    ...decodedRecipe.steps.map((step) => step.text),
    ...decodedRecipe.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function decodeRecipeText<T extends Recipe>(recipe: T): T {
  return {
    ...recipe,
    title: decodeHtmlEntities(recipe.title),
    description: decodeOptionalHtmlEntities(recipe.description),
    images: recipe.images?.map((image) => ({
      ...image,
      alt: decodeOptionalHtmlEntities(image.alt),
    })),
    source: recipe.source
      ? {
          ...recipe.source,
          name: decodeOptionalHtmlEntities(recipe.source.name),
          externalId: decodeOptionalHtmlEntities(recipe.source.externalId),
        }
      : undefined,
    servings: decodeOptionalHtmlEntities(recipe.servings),
    tags: recipe.tags.map(decodeHtmlEntities),
    ingredients: recipe.ingredients.map(decodeIngredientText),
    steps: recipe.steps.map(decodeStepText),
    notes: recipe.notes.map(decodeHtmlEntities),
  } as T;
}

export function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    if (entity.startsWith("#x")) {
      return decodeNumericHtmlEntity(match, entity.slice(2), 16);
    }
    if (entity.startsWith("#")) {
      return decodeNumericHtmlEntity(match, entity.slice(1), 10);
    }

    return htmlEntityMap[entity.toLowerCase()] ?? match;
  });
}

const htmlEntityMap: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "...",
  laquo: "<<",
  ldquo: '"',
  lsquo: "'",
  lt: "<",
  mdash: "-",
  nbsp: " ",
  ndash: "-",
  quot: '"',
  raquo: ">>",
  rdquo: '"',
  rsquo: "'",
};

function decodeOptionalHtmlEntities(value?: string) {
  return value === undefined ? undefined : decodeHtmlEntities(value);
}

function decodeNumericHtmlEntity(match: string, value: string, radix: number) {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return match;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return match;
  }
}

function decodeIngredientText(ingredient: RecipeIngredient): RecipeIngredient {
  return {
    ...ingredient,
    section: decodeOptionalHtmlEntities(ingredient.section),
    text: decodeHtmlEntities(ingredient.text),
    quantity: ingredient.quantity
      ? {
          ...ingredient.quantity,
          valueText: decodeOptionalHtmlEntities(ingredient.quantity.valueText),
          unit: decodeOptionalHtmlEntities(ingredient.quantity.unit),
        }
      : undefined,
    item: decodeOptionalHtmlEntities(ingredient.item),
    preparation: decodeOptionalHtmlEntities(ingredient.preparation),
    note: decodeOptionalHtmlEntities(ingredient.note),
    warnings: ingredient.warnings?.map(decodeHtmlEntities),
  };
}

function decodeStepText(step: RecipeStep): RecipeStep {
  return {
    ...step,
    section: decodeOptionalHtmlEntities(step.section),
    text: decodeHtmlEntities(step.text),
    timers: step.timers?.map((timer) => ({
      ...timer,
      label: decodeOptionalHtmlEntities(timer.label),
    })),
    equipment: step.equipment?.map(decodeHtmlEntities),
    warnings: step.warnings?.map(decodeHtmlEntities),
  };
}
