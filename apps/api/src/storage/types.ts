import type { CreateRecipeInput, Recipe, UpdateRecipeInput } from "@open-cook/core";

export type RecipeListFilters = {
  q?: string;
  tag?: string;
  source?: string;
};

export type ImportResult = {
  created: number;
  updated: number;
  recipes: Recipe[];
};

export interface RecipeStore {
  list(filters?: RecipeListFilters): Promise<Recipe[]>;
  get(id: string): Promise<Recipe | undefined>;
  create(input: CreateRecipeInput): Promise<Recipe>;
  update(id: string, input: UpdateRecipeInput): Promise<Recipe | undefined>;
  delete(id: string): Promise<boolean>;
  upsertMany(recipes: Recipe[]): Promise<ImportResult>;
  replaceAll(recipes: Recipe[]): Promise<void>;
}
