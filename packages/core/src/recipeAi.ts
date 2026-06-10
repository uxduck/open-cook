import * as v from "valibot";
import { recipeIngredientSchema, recipeSchema, recipeStepSchema } from "./recipe";

export const recipeAiPromptSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(2_000),
);

export const recipeAiAudienceSchema = v.picklist([
  "general",
  "family",
  "children",
  "adults",
]);

export const recipeDraftSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1)),
  description: v.optional(v.pipe(v.string(), v.trim())),
  prepTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  cookTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  totalTimeMinutes: v.optional(v.pipe(v.number(), v.minValue(0))),
  servings: v.optional(v.pipe(v.string(), v.trim())),
  tags: v.array(v.pipe(v.string(), v.trim())),
  ingredients: v.array(recipeIngredientSchema),
  steps: v.array(recipeStepSchema),
  notes: v.array(v.pipe(v.string(), v.trim())),
});

export const recipeRemixControlsSchema = v.object({
  prompt: recipeAiPromptSchema,
  audience: v.optional(recipeAiAudienceSchema),
  theme: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  includeImagePrompt: v.optional(v.boolean()),
});

export const recipeRemixInputSchema = v.object({
  recipe: recipeSchema,
  prompt: recipeAiPromptSchema,
  audience: v.optional(recipeAiAudienceSchema),
  theme: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  includeImagePrompt: v.optional(v.boolean()),
});

export const recipeRemixResultSchema = v.object({
  draft: recipeDraftSchema,
  changes: v.array(v.pipe(v.string(), v.trim())),
  safetyNotes: v.array(v.pipe(v.string(), v.trim())),
  imagePrompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
});

export const recipeImageGenerationInputSchema = v.object({
  recipe: recipeDraftSchema,
  prompt: v.optional(recipeAiPromptSchema),
  size: v.optional(v.picklist(["1024x1024", "1536x1024", "1024x1536"])),
  steps: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50))),
});

export const recipeAiProviderMetadataSchema = v.object({
  provider: v.string(),
  model: v.string(),
});

export const generatedRecipeImageSchema = v.object({
  url: v.optional(v.pipe(v.string(), v.url())),
  prompt: v.string(),
  contentType: v.string(),
  size: v.number(),
  provider: recipeAiProviderMetadataSchema,
});

export type RecipeAiAudience = v.InferOutput<typeof recipeAiAudienceSchema>;
export type RecipeDraft = v.InferOutput<typeof recipeDraftSchema>;
export type RecipeRemixControls = v.InferOutput<typeof recipeRemixControlsSchema>;
export type RecipeRemixInput = v.InferOutput<typeof recipeRemixInputSchema>;
export type RecipeRemixResult = v.InferOutput<typeof recipeRemixResultSchema>;
export type RecipeImageGenerationInput = v.InferOutput<
  typeof recipeImageGenerationInputSchema
>;
export type RecipeAiProviderMetadata = v.InferOutput<
  typeof recipeAiProviderMetadataSchema
>;
export type GeneratedRecipeImage = v.InferOutput<typeof generatedRecipeImageSchema>;
