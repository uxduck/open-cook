import {
  type CreateRecipeInput,
  createRecipeRecord,
  type Recipe,
  recipeSearchText,
  seedRecipes,
  type UpdateRecipeInput,
  updateRecipeRecord,
} from "@open-cook/core";
import type { ImportResult, RecipeListFilters, RecipeStore } from "./types";

export function createMemoryRecipeStore(initialRecipes = seedRecipes): RecipeStore {
  let recipes = [...initialRecipes];

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
        byId.set(recipe.id, recipe);
      }

      recipes = [...byId.values()];
      return { created, updated, recipes: importedRecipes };
    },

    async replaceAll(nextRecipes: Recipe[]) {
      recipes = [...nextRecipes];
    },
  };
}
