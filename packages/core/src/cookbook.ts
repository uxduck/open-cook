import * as v from "valibot";
import { recipeOwnerSchema, sharedRecipeSchema } from "./recipe";

export const cookbookVisibilitySchema = v.picklist(["private", "unlisted", "public"]);

export const cookbookKindSchema = v.picklist(["top_level", "custom"]);

export const cookbookSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  kind: cookbookKindSchema,
  slug: v.pipe(v.string(), v.minLength(1)),
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  visibility: cookbookVisibilitySchema,
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const ownedCookbookSchema = v.object({
  ...cookbookSchema.entries,
  recipeIds: v.array(v.pipe(v.string(), v.minLength(1))),
});

export const publicCookbookSchema = v.object({
  ...cookbookSchema.entries,
  owner: recipeOwnerSchema,
  recipes: v.array(sharedRecipeSchema),
});

export const cookbookRecipeSchema = v.object({
  cookbook: publicCookbookSchema,
  recipe: sharedRecipeSchema,
});

export type CookbookVisibility = v.InferOutput<typeof cookbookVisibilitySchema>;
export type CookbookKind = v.InferOutput<typeof cookbookKindSchema>;
export type Cookbook = v.InferOutput<typeof cookbookSchema>;
export type OwnedCookbook = v.InferOutput<typeof ownedCookbookSchema>;
export type PublicCookbook = v.InferOutput<typeof publicCookbookSchema>;
export type CookbookRecipe = v.InferOutput<typeof cookbookRecipeSchema>;
