import {
  type CreateRecipeInput,
  createRecipeRecord,
  decodeRecipeText,
  type Recipe,
  type RecipeCookProgress,
  type RecipeCookProgressInput,
  recipeSearchText,
  seedRecipes,
  type UpdateRecipeInput,
  updateRecipeRecord,
} from "@open-cook/core";
import type { ImportResult, RecipeListFilters, RecipeStore } from "./types";

export function createMemoryRecipeStore(initialRecipes = seedRecipes): RecipeStore {
  let recipes = initialRecipes.map(decodeRecipeText);
  const cookProgressByRecipeId = new Map<string, RecipeCookProgress>();

  return {
    async list(filters: RecipeListFilters = {}) {
      const q = filters.q?.trim().toLowerCase();
      const tag = filters.tag?.trim().toLowerCase();
      const source = filters.source?.trim().toLowerCase();

      return recipes
        .filter((recipe) => {
          if (q && !recipeSearchText(recipe).includes(q)) {
            return false;
          }
          if (tag && !recipe.tags.some((value) => value.toLowerCase() === tag)) {
            return false;
          }
          if (
            source &&
            recipe.source?.name?.toLowerCase() !== source &&
            !recipe.source?.url?.toLowerCase().includes(source)
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.title.localeCompare(b.title));
    },

    async count() {
      return recipes.length;
    },

    async get(id: string) {
      return recipes.find((recipe) => recipe.id === id);
    },

    async create(input: CreateRecipeInput) {
      const recipe = createRecipeRecord(input);
      recipes = [...recipes, recipe];
      return recipe;
    },

    async update(id: string, input: UpdateRecipeInput) {
      const recipe = recipes.find((item) => item.id === id);
      if (!recipe) {
        return undefined;
      }
      const updatedRecipe = updateRecipeRecord(recipe, input);
      recipes = recipes.map((item) => (item.id === id ? updatedRecipe : item));
      return updatedRecipe;
    },

    async delete(id: string) {
      const before = recipes.length;
      recipes = recipes.filter((recipe) => recipe.id !== id);
      cookProgressByRecipeId.delete(id);
      return recipes.length !== before;
    },

    async upsertMany(importedRecipes: Recipe[]): Promise<ImportResult> {
      let created = 0;
      let updated = 0;
      const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

      for (const recipe of importedRecipes) {
        if (byId.has(recipe.id)) {
          updated += 1;
        } else {
          created += 1;
        }
        byId.set(recipe.id, decodeRecipeText(recipe));
      }

      recipes = [...byId.values()];
      return { created, updated, recipes: importedRecipes.map(decodeRecipeText) };
    },

    async replaceAll(nextRecipes: Recipe[]) {
      recipes = nextRecipes.map(decodeRecipeText);
      const nextIds = new Set(recipes.map((recipe) => recipe.id));
      for (const id of cookProgressByRecipeId.keys()) {
        if (!nextIds.has(id)) {
          cookProgressByRecipeId.delete(id);
        }
      }
    },

    async listSharedWithMe() {
      return [];
    },

    async listPublic(filters: RecipeListFilters = {}) {
      const publicRecipes = await this.list(filters);
      return publicRecipes
        .filter((recipe) => recipe.visibility === "public")
        .map((recipe) => ({ ...recipe, owner: memoryOwner }));
    },

    async copyFrom(_ownerId: string, recipeId: string) {
      const source = recipes.find((recipe) => recipe.id === recipeId);
      if (!source) {
        return undefined;
      }
      const timestamp = new Date().toISOString();
      const copy: Recipe = {
        ...source,
        id: crypto.randomUUID(),
        visibility: "private",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      recipes = [...recipes, copy];
      return copy;
    },

    async markShareSeen() {
      return undefined;
    },

    async dismissShare() {
      return false;
    },

    async listShares(recipeId: string) {
      return recipes.some((recipe) => recipe.id === recipeId) ? [] : undefined;
    },

    async share(recipeId: string) {
      if (!recipes.some((recipe) => recipe.id === recipeId)) {
        return { ok: false as const, reason: "recipe_not_found" as const };
      }
      return { ok: false as const, reason: "user_not_found" as const };
    },

    async unshare() {
      return false;
    },

    async getCookProgress(recipeId: string) {
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) {
        return undefined;
      }
      return cookProgressByRecipeId.get(recipeId) ?? emptyCookProgress(recipeId);
    },

    async updateCookProgress(recipeId: string, input: RecipeCookProgressInput) {
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) {
        return undefined;
      }

      const progress: RecipeCookProgress = {
        recipeId,
        checkedIngredientIds: uniqueIds(input.checkedIngredientIds),
        checkedStepIds: uniqueIds(input.checkedStepIds),
      };
      cookProgressByRecipeId.set(recipeId, progress);
      return progress;
    },

    async resetCookProgress(recipeId: string) {
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) {
        return false;
      }
      cookProgressByRecipeId.delete(recipeId);
      return true;
    },
  };
}

const memoryOwner = { id: "memory", name: "Local kitchen" };

function emptyCookProgress(recipeId: string): RecipeCookProgress {
  return { recipeId, checkedIngredientIds: [], checkedStepIds: [] };
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter((id) => id.length > 0))];
}
