import type {
  CreateRecipeInput,
  Recipe,
  RecipeCookProgress,
  RecipeCookProgressInput,
  RecipeShare,
  SharedRecipe,
  UpdateRecipeInput,
} from "@open-cook/core";

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

export type ShareRecipeResult =
  | { ok: true; share: RecipeShare }
  | { ok: false; reason: "recipe_not_found" | "user_not_found" | "self_share" };

export interface RecipeStore {
  list(filters?: RecipeListFilters): Promise<Recipe[]>;
  count(): Promise<number>;
  get(id: string): Promise<Recipe | undefined>;
  create(input: CreateRecipeInput): Promise<Recipe>;
  update(id: string, input: UpdateRecipeInput): Promise<Recipe | undefined>;
  delete(id: string): Promise<boolean>;
  upsertMany(recipes: Recipe[]): Promise<ImportResult>;
  replaceAll(recipes: Recipe[]): Promise<void>;
  listSharedWithMe(): Promise<SharedRecipe[]>;
  listPublic(filters?: RecipeListFilters): Promise<SharedRecipe[]>;
  copyFrom(ownerId: string, recipeId: string): Promise<Recipe | undefined>;
  markShareSeen(ownerId: string, recipeId: string): Promise<SharedRecipe | undefined>;
  dismissShare(ownerId: string, recipeId: string): Promise<boolean>;
  listShares(recipeId: string): Promise<RecipeShare[] | undefined>;
  share(recipeId: string, identifier: string): Promise<ShareRecipeResult>;
  unshare(recipeId: string, sharedWithUserId: string): Promise<boolean>;
  getCookProgress(recipeId: string): Promise<RecipeCookProgress | undefined>;
  updateCookProgress(
    recipeId: string,
    input: RecipeCookProgressInput,
  ): Promise<RecipeCookProgress | undefined>;
  resetCookProgress(recipeId: string): Promise<boolean>;
}
