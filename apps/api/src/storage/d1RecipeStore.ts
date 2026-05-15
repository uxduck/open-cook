import {
  type CreateRecipeInput,
  createRecipeRecord,
  type Recipe,
  recipeSearchText,
  type UpdateRecipeInput,
  updateRecipeRecord,
} from "@open-cook/core";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { type NewRecipeRow, type RecipeRow, recipes } from "../db/schema";
import type { ImportResult, RecipeListFilters, RecipeStore } from "./types";

export function createD1RecipeStore(database: D1Database): RecipeStore {
  const db = drizzle(database);

  return {
    async list(filters: RecipeListFilters = {}) {
      const rows = await db.select().from(recipes).orderBy(recipes.title);
      return rows.map(rowToRecipe).filter((recipe) => matchesFilters(recipe, filters));
    },

    async get(id: string) {
      const row = await db.select().from(recipes).where(eq(recipes.id, id)).get();
      return row ? rowToRecipe(row) : undefined;
    },

    async create(input: CreateRecipeInput) {
      const recipe = createRecipeRecord(input);
      await db.insert(recipes).values(recipeToRow(recipe));
      return recipe;
    },

    async update(id: string, input: UpdateRecipeInput) {
      const existing = await this.get(id);
      if (!existing) {
        return undefined;
      }

      const updatedRecipe = updateRecipeRecord(existing, input);
      await db
        .update(recipes)
        .set(recipeToRow(updatedRecipe))
        .where(eq(recipes.id, id));
      return updatedRecipe;
    },

    async delete(id: string) {
      const existing = await this.get(id);
      if (!existing) {
        return false;
      }
      await db.delete(recipes).where(eq(recipes.id, id));
      return true;
    },

    async upsertMany(importedRecipes: Recipe[]): Promise<ImportResult> {
      let created = 0;
      let updated = 0;

      for (const recipe of importedRecipes) {
        const exists = await this.get(recipe.id);
        await db
          .insert(recipes)
          .values(recipeToRow(recipe))
          .onConflictDoUpdate({
            target: recipes.id,
            set: recipeToRow(recipe),
          });

        if (exists) {
          updated += 1;
        } else {
          created += 1;
        }
      }

      return { created, updated, recipes: importedRecipes };
    },

    async replaceAll(nextRecipes: Recipe[]) {
      await db.delete(recipes);
      for (const recipe of nextRecipes) {
        await db.insert(recipes).values(recipeToRow(recipe));
      }
    },
  };
}

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    source: row.source ?? undefined,
    prepTimeMinutes: row.prepTimeMinutes ?? undefined,
    cookTimeMinutes: row.cookTimeMinutes ?? undefined,
    totalTimeMinutes: row.totalTimeMinutes ?? undefined,
    servings: row.servings ?? undefined,
    tags: row.tags ?? [],
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    notes: row.notes ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function recipeToRow(recipe: Recipe): NewRecipeRow {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    source: recipe.source,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    servings: recipe.servings,
    tags: recipe.tags,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

function matchesFilters(recipe: Recipe, filters: RecipeListFilters) {
  const q = filters.q?.trim().toLowerCase();
  const tag = filters.tag?.trim().toLowerCase();
  const source = filters.source?.trim().toLowerCase();

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
}
