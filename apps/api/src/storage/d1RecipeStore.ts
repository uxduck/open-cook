import {
  type CreateRecipeInput,
  createRecipeRecord,
  decodeRecipeText,
  nowIso,
  type Recipe,
  type RecipeCookProgress,
  type RecipeCookProgressInput,
  type RecipeOwner,
  recipeSearchText,
  type SharedRecipe,
  type UpdateRecipeInput,
  updateRecipeRecord,
} from "@open-cook/core";
import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  type NewRecipeRow,
  recipeCookProgress,
  type RecipeCookProgressRow,
  type RecipeRow,
  recipeShares,
  recipes,
  user,
} from "../db/schema";
import { normalizeEmail } from "../features/auth/emailNormalization";
import type { ImportResult, RecipeListFilters, RecipeStore } from "./types";

export function createD1RecipeStore(database: D1Database, userId: string): RecipeStore {
  const db = drizzle(database);

  return {
    async list(filters: RecipeListFilters = {}) {
      const rows = await db
        .select()
        .from(recipes)
        .where(eq(recipes.userId, userId))
        .orderBy(recipes.title);
      return rows.map(rowToRecipe).filter((recipe) => matchesFilters(recipe, filters));
    },

    async count() {
      const row = await db
        .select({ value: count() })
        .from(recipes)
        .where(eq(recipes.userId, userId))
        .get();
      return row?.value ?? 0;
    },

    async get(id: string) {
      const row = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.userId, userId), eq(recipes.id, id)))
        .get();
      return row ? rowToRecipe(row) : undefined;
    },

    async create(input: CreateRecipeInput) {
      const recipe = createRecipeRecord(input);
      await db.insert(recipes).values(recipeToRow(recipe, userId));
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
        .set(recipeToRow(updatedRecipe, userId))
        .where(and(eq(recipes.userId, userId), eq(recipes.id, id)));
      return updatedRecipe;
    },

    async delete(id: string) {
      const existing = await this.get(id);
      if (!existing) {
        return false;
      }
      await db
        .delete(recipes)
        .where(and(eq(recipes.userId, userId), eq(recipes.id, id)));
      return true;
    },

    async upsertMany(importedRecipes: Recipe[]): Promise<ImportResult> {
      let created = 0;
      let updated = 0;
      const decodedRecipes = importedRecipes.map(decodeRecipeText);

      for (const recipe of decodedRecipes) {
        const exists = await this.get(recipe.id);
        await db
          .insert(recipes)
          .values(recipeToRow(recipe, userId))
          .onConflictDoUpdate({
            target: [recipes.userId, recipes.id],
            set: recipeToRow(recipe, userId),
          });

        if (exists) {
          updated += 1;
        } else {
          created += 1;
        }
      }

      return { created, updated, recipes: decodedRecipes };
    },

    async replaceAll(nextRecipes: Recipe[]) {
      await db.delete(recipes).where(eq(recipes.userId, userId));
      for (const recipe of nextRecipes.map(decodeRecipeText)) {
        await db.insert(recipes).values(recipeToRow(recipe, userId));
      }
    },

    async listSharedWithMe() {
      const rows = await db
        .select({
          recipe: recipes,
          owner: ownerColumns,
          sharedAt: recipeShares.createdAt,
          seenAt: recipeShares.seenAt,
          dismissedAt: recipeShares.dismissedAt,
          copiedRecipeId: recipeShares.copiedRecipeId,
        })
        .from(recipeShares)
        .innerJoin(
          recipes,
          and(
            eq(recipes.userId, recipeShares.ownerId),
            eq(recipes.id, recipeShares.recipeId),
          ),
        )
        .innerJoin(user, eq(user.id, recipeShares.ownerId))
        .where(
          and(
            eq(recipeShares.sharedWithUserId, userId),
            isNull(recipeShares.dismissedAt),
          ),
        )
        .orderBy(desc(recipeShares.createdAt));

      return rows.map(sharedRecipeFromRow);
    },

    async listPublic(filters: RecipeListFilters = {}) {
      const rows = await db
        .select({ recipe: recipes, owner: ownerColumns })
        .from(recipes)
        .innerJoin(user, eq(user.id, recipes.userId))
        .where(eq(recipes.visibility, "public"))
        .orderBy(desc(recipes.updatedAt));

      return rows
        .map((row) => ({ ...rowToRecipe(row.recipe), owner: toOwner(row.owner) }))
        .filter((recipe) => matchesFilters(recipe, filters));
    },

    async copyFrom(ownerId: string, recipeId: string) {
      const row = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.userId, ownerId), eq(recipes.id, recipeId)))
        .get();
      if (!row) {
        return undefined;
      }

      const canCopy =
        ownerId === userId ||
        row.visibility !== "private" ||
        Boolean(
          await db
            .select({ recipeId: recipeShares.recipeId })
            .from(recipeShares)
            .where(
              and(
                eq(recipeShares.ownerId, ownerId),
                eq(recipeShares.recipeId, recipeId),
                eq(recipeShares.sharedWithUserId, userId),
              ),
            )
            .get(),
        );
      if (!canCopy) {
        return undefined;
      }

      const timestamp = nowIso();
      const copy: Recipe = {
        ...rowToRecipe(row),
        id: crypto.randomUUID(),
        visibility: "private",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(recipes).values(recipeToRow(copy, userId));
      await db
        .update(recipeShares)
        .set({ copiedRecipeId: copy.id, seenAt: timestamp })
        .where(
          and(
            eq(recipeShares.ownerId, ownerId),
            eq(recipeShares.recipeId, recipeId),
            eq(recipeShares.sharedWithUserId, userId),
          ),
        );
      return copy;
    },

    async markShareSeen(ownerId: string, recipeId: string) {
      const existing = await db
        .select({ seenAt: recipeShares.seenAt })
        .from(recipeShares)
        .where(
          and(
            eq(recipeShares.ownerId, ownerId),
            eq(recipeShares.recipeId, recipeId),
            eq(recipeShares.sharedWithUserId, userId),
            isNull(recipeShares.dismissedAt),
          ),
        )
        .get();
      if (!existing) {
        return undefined;
      }

      const seenAt = existing.seenAt ?? nowIso();
      if (!existing.seenAt) {
        await db
          .update(recipeShares)
          .set({ seenAt })
          .where(
            and(
              eq(recipeShares.ownerId, ownerId),
              eq(recipeShares.recipeId, recipeId),
              eq(recipeShares.sharedWithUserId, userId),
              isNull(recipeShares.dismissedAt),
            ),
          );
      }

      const row = await db
        .select({
          recipe: recipes,
          owner: ownerColumns,
          sharedAt: recipeShares.createdAt,
          seenAt: recipeShares.seenAt,
          dismissedAt: recipeShares.dismissedAt,
          copiedRecipeId: recipeShares.copiedRecipeId,
        })
        .from(recipeShares)
        .innerJoin(
          recipes,
          and(
            eq(recipes.userId, recipeShares.ownerId),
            eq(recipes.id, recipeShares.recipeId),
          ),
        )
        .innerJoin(user, eq(user.id, recipeShares.ownerId))
        .where(
          and(
            eq(recipeShares.ownerId, ownerId),
            eq(recipeShares.recipeId, recipeId),
            eq(recipeShares.sharedWithUserId, userId),
            isNull(recipeShares.dismissedAt),
          ),
        )
        .get();

      return row ? sharedRecipeFromRow(row) : undefined;
    },

    async dismissShare(ownerId: string, recipeId: string) {
      const existing = await db
        .select({ recipeId: recipeShares.recipeId })
        .from(recipeShares)
        .where(
          and(
            eq(recipeShares.ownerId, ownerId),
            eq(recipeShares.recipeId, recipeId),
            eq(recipeShares.sharedWithUserId, userId),
            isNull(recipeShares.dismissedAt),
          ),
        )
        .get();
      if (!existing) {
        return false;
      }

      await db
        .update(recipeShares)
        .set({ dismissedAt: nowIso() })
        .where(
          and(
            eq(recipeShares.ownerId, ownerId),
            eq(recipeShares.recipeId, recipeId),
            eq(recipeShares.sharedWithUserId, userId),
            isNull(recipeShares.dismissedAt),
          ),
        );
      return true;
    },

    async listShares(recipeId: string) {
      const owned = await this.get(recipeId);
      if (!owned) {
        return undefined;
      }

      const rows = await db
        .select({
          sharedWith: ownerColumns,
          createdAt: recipeShares.createdAt,
          seenAt: recipeShares.seenAt,
          dismissedAt: recipeShares.dismissedAt,
          copiedRecipeId: recipeShares.copiedRecipeId,
        })
        .from(recipeShares)
        .innerJoin(user, eq(user.id, recipeShares.sharedWithUserId))
        .where(
          and(eq(recipeShares.ownerId, userId), eq(recipeShares.recipeId, recipeId)),
        )
        .orderBy(desc(recipeShares.createdAt));

      return rows.map((row) => ({
        recipeId,
        sharedWith: toOwner(row.sharedWith),
        createdAt: row.createdAt,
        seenAt: row.seenAt ?? undefined,
        dismissedAt: row.dismissedAt ?? undefined,
        copiedRecipeId: row.copiedRecipeId ?? undefined,
      }));
    },

    async share(recipeId: string, identifier: string) {
      const owned = await this.get(recipeId);
      if (!owned) {
        return { ok: false as const, reason: "recipe_not_found" as const };
      }

      const trimmed = identifier.trim();
      // Match the recipient by canonical email so aliases (johndoe+x@gmail.com)
      // resolve to the same account that signed up, or by username. For a
      // username input normalizeEmail just lowercases it, which won't collide
      // with any real (@-bearing) normalized email.
      const target = await db
        .select(ownerColumns)
        .from(user)
        .where(
          or(
            eq(user.normalizedEmail, normalizeEmail(trimmed)),
            eq(user.username, trimmed.toLowerCase()),
          ),
        )
        .get();
      if (!target) {
        return { ok: false as const, reason: "user_not_found" as const };
      }
      if (target.id === userId) {
        return { ok: false as const, reason: "self_share" as const };
      }

      const createdAt = nowIso();
      await db
        .insert(recipeShares)
        .values({
          ownerId: userId,
          recipeId,
          sharedWithUserId: target.id,
          createdAt,
        })
        .onConflictDoUpdate({
          target: [
            recipeShares.ownerId,
            recipeShares.recipeId,
            recipeShares.sharedWithUserId,
          ],
          set: {
            createdAt,
            seenAt: null,
            dismissedAt: null,
          },
        });

      return {
        ok: true as const,
        share: { recipeId, sharedWith: toOwner(target), createdAt },
      };
    },

    async unshare(recipeId: string, sharedWithUserId: string) {
      const existing = await db
        .select({ recipeId: recipeShares.recipeId })
        .from(recipeShares)
        .where(
          and(
            eq(recipeShares.ownerId, userId),
            eq(recipeShares.recipeId, recipeId),
            eq(recipeShares.sharedWithUserId, sharedWithUserId),
          ),
        )
        .get();
      if (!existing) {
        return false;
      }

      await db
        .delete(recipeShares)
        .where(
          and(
            eq(recipeShares.ownerId, userId),
            eq(recipeShares.recipeId, recipeId),
            eq(recipeShares.sharedWithUserId, sharedWithUserId),
          ),
        );
      return true;
    },

    async getCookProgress(recipeId: string) {
      const owned = await this.get(recipeId);
      if (!owned) {
        return undefined;
      }

      const row = await db
        .select()
        .from(recipeCookProgress)
        .where(
          and(
            eq(recipeCookProgress.userId, userId),
            eq(recipeCookProgress.recipeUserId, userId),
            eq(recipeCookProgress.recipeId, recipeId),
          ),
        )
        .get();

      return row ? cookProgressFromRow(row) : emptyCookProgress(recipeId);
    },

    async updateCookProgress(recipeId: string, input: RecipeCookProgressInput) {
      const owned = await this.get(recipeId);
      if (!owned) {
        return undefined;
      }

      const progress: RecipeCookProgress = {
        recipeId,
        checkedIngredientIds: uniqueIds(input.checkedIngredientIds),
        checkedStepIds: uniqueIds(input.checkedStepIds),
      };
      const updatedAt = nowIso();

      await db
        .insert(recipeCookProgress)
        .values({
          userId,
          recipeUserId: userId,
          recipeId,
          checkedIngredientIds: progress.checkedIngredientIds,
          checkedStepIds: progress.checkedStepIds,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: [
            recipeCookProgress.userId,
            recipeCookProgress.recipeUserId,
            recipeCookProgress.recipeId,
          ],
          set: {
            checkedIngredientIds: progress.checkedIngredientIds,
            checkedStepIds: progress.checkedStepIds,
            updatedAt,
          },
        });

      return progress;
    },

    async resetCookProgress(recipeId: string) {
      const owned = await this.get(recipeId);
      if (!owned) {
        return false;
      }

      await db
        .delete(recipeCookProgress)
        .where(
          and(
            eq(recipeCookProgress.userId, userId),
            eq(recipeCookProgress.recipeUserId, userId),
            eq(recipeCookProgress.recipeId, recipeId),
          ),
        );
      return true;
    },
  };
}

export async function getRecipeByLink(
  database: D1Database,
  ownerId: string,
  recipeId: string,
  viewerId?: string,
): Promise<SharedRecipe | undefined> {
  const db = drizzle(database);
  const row = await db
    .select({ recipe: recipes, owner: ownerColumns })
    .from(recipes)
    .innerJoin(user, eq(user.id, recipes.userId))
    .where(and(eq(recipes.userId, ownerId), eq(recipes.id, recipeId)))
    .get();
  if (!row) {
    return undefined;
  }

  const canView =
    row.recipe.visibility !== "private" ||
    viewerId === ownerId ||
    (viewerId
      ? Boolean(
          await db
            .select({ recipeId: recipeShares.recipeId })
            .from(recipeShares)
            .where(
              and(
                eq(recipeShares.ownerId, ownerId),
                eq(recipeShares.recipeId, recipeId),
                eq(recipeShares.sharedWithUserId, viewerId),
              ),
            )
            .get(),
        )
      : false);
  if (!canView) {
    return undefined;
  }

  return { ...rowToRecipe(row.recipe), owner: toOwner(row.owner) };
}

export async function listPublicRecipes(
  database: D1Database,
  filters: RecipeListFilters = {},
): Promise<SharedRecipe[]> {
  const db = drizzle(database);
  const rows = await db
    .select({ recipe: recipes, owner: ownerColumns })
    .from(recipes)
    .innerJoin(user, eq(user.id, recipes.userId))
    .where(eq(recipes.visibility, "public"))
    .orderBy(desc(recipes.updatedAt));

  return rows
    .map((row) => ({ ...rowToRecipe(row.recipe), owner: toOwner(row.owner) }))
    .filter((recipe) => matchesFilters(recipe, filters));
}

const ownerColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  displayUsername: user.displayUsername,
};

function toOwner(row: {
  id: string;
  name: string;
  username: string | null;
  displayUsername: string | null;
}): RecipeOwner {
  return {
    id: row.id,
    name: row.name,
    username: row.displayUsername ?? row.username ?? undefined,
  };
}

function sharedRecipeFromRow(row: {
  recipe: RecipeRow;
  owner: {
    id: string;
    name: string;
    username: string | null;
    displayUsername: string | null;
  };
  sharedAt: string;
  seenAt: string | null;
  dismissedAt: string | null;
  copiedRecipeId: string | null;
}): SharedRecipe {
  return {
    ...rowToRecipe(row.recipe),
    owner: toOwner(row.owner),
    sharedAt: row.sharedAt,
    seenAt: row.seenAt ?? undefined,
    dismissedAt: row.dismissedAt ?? undefined,
    copiedRecipeId: row.copiedRecipeId ?? undefined,
  };
}

function emptyCookProgress(recipeId: string): RecipeCookProgress {
  return { recipeId, checkedIngredientIds: [], checkedStepIds: [] };
}

function cookProgressFromRow(row: RecipeCookProgressRow): RecipeCookProgress {
  return {
    recipeId: row.recipeId,
    checkedIngredientIds: row.checkedIngredientIds ?? [],
    checkedStepIds: row.checkedStepIds ?? [],
  };
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter((id) => id.length > 0))];
}

function rowToRecipe(row: RecipeRow): Recipe {
  return decodeRecipeText({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    images: row.images ?? undefined,
    source: row.source ?? undefined,
    prepTimeMinutes: row.prepTimeMinutes ?? undefined,
    cookTimeMinutes: row.cookTimeMinutes ?? undefined,
    totalTimeMinutes: row.totalTimeMinutes ?? undefined,
    servings: row.servings ?? undefined,
    tags: row.tags ?? [],
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    notes: row.notes ?? [],
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function recipeToRow(recipe: Recipe, userId: string): NewRecipeRow {
  const decodedRecipe = decodeRecipeText(recipe);

  return {
    id: decodedRecipe.id,
    userId,
    title: decodedRecipe.title,
    description: decodedRecipe.description,
    imageUrl: decodedRecipe.imageUrl,
    images: decodedRecipe.images,
    source: decodedRecipe.source,
    prepTimeMinutes: decodedRecipe.prepTimeMinutes,
    cookTimeMinutes: decodedRecipe.cookTimeMinutes,
    totalTimeMinutes: decodedRecipe.totalTimeMinutes,
    servings: decodedRecipe.servings,
    tags: decodedRecipe.tags,
    ingredients: decodedRecipe.ingredients,
    steps: decodedRecipe.steps,
    notes: decodedRecipe.notes,
    visibility: decodedRecipe.visibility ?? "private",
    createdAt: decodedRecipe.createdAt,
    updatedAt: decodedRecipe.updatedAt,
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
