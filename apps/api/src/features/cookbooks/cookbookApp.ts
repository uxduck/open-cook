import {
  type Cookbook,
  type CookbookRecipe,
  cookbookRecipeSchema,
  type CookbookVisibility,
  decodeRecipeText,
  nowIso,
  type OwnedCookbook,
  ownedCookbookSchema,
  type PublicCookbook,
  publicCookbookSchema,
  type Recipe,
  type RecipeOwner,
  type SharedRecipe,
} from "@open-cook/core";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import {
  cookbookRecipes,
  type CookbookRow,
  cookbooks,
  type NewCookbookRow,
  type RecipeRow,
  recipes,
  user,
} from "../../db/schema";
import { requireAuthMiddleware } from "../auth/requireAuth";

const topLevelKind = "top_level" as const;
const customKind = "custom" as const;
const slugSuffixLength = 8;
const topLevelDefaultTitle = "All your recipes";
const topLevelDefaultDescription = "Share all your recipes from one place.";

const slugParamSchema = v.object({
  slug: v.pipe(v.string(), v.minLength(1)),
});

const cookbookRecipeParamSchema = v.object({
  recipeId: v.pipe(v.string(), v.minLength(1)),
  slug: v.pipe(v.string(), v.minLength(1)),
});

const cookbookIdParamSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
});

const ownerIdParamSchema = v.object({
  ownerId: v.pipe(v.string(), v.minLength(1)),
});

const createCookbookSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  visibility: v.optional(v.picklist(["private", "unlisted", "public"])),
  recipeIds: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
});

const updateCookbookSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
  description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  visibility: v.optional(v.picklist(["private", "unlisted", "public"])),
  recipeIds: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
});

export const cookbookApp = new Hono<Env>()
  .get(
    "/top-level/:ownerId",
    describeRoute({
      description:
        "Resolve a user's top-level cookbook. Private cookbooks require owner access; unlisted and public cookbooks work by link.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(publicCookbookSchema) },
          },
          description: "Cookbook resolved.",
        },
        404: { description: "Cookbook not found or not accessible." },
      },
    }),
    validator("param", ownerIdParamSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const { ownerId } = c.req.valid("param");
      const cookbook = await getTopLevelPublicCookbook(c, ownerId, c.var.user?.id);
      return cookbook
        ? c.json(cookbook)
        : c.json({ error: "Cookbook not found or not accessible" }, 404);
    },
  )
  .get(
    "/top-level/:ownerId/recipes/:recipeId",
    describeRoute({
      description:
        "Resolve a recipe through a top-level cookbook. Cookbook visibility, not the recipe's standalone visibility, controls access.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(cookbookRecipeSchema) },
          },
          description: "Cookbook recipe resolved.",
        },
        404: { description: "Recipe not found or not accessible through cookbook." },
      },
    }),
    validator(
      "param",
      v.object({
        ownerId: v.pipe(v.string(), v.minLength(1)),
        recipeId: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const { ownerId, recipeId } = c.req.valid("param");
      const cookbook = await getTopLevelPublicCookbook(c, ownerId, c.var.user?.id);
      const recipe = cookbook?.recipes.find((item) => item.id === recipeId);
      return cookbook && recipe
        ? c.json({ cookbook, recipe })
        : c.json({ error: "Recipe not found or not accessible" }, 404);
    },
  )
  .get(
    "/public",
    describeRoute({
      description: "List cookbooks any user has made public. No session required.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(v.array(publicCookbookSchema)) },
          },
          description: "Public cookbooks retrieved successfully.",
        },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      return c.json(await listPublicCookbooks(c));
    },
  )
  .get(
    "/",
    requireAuthMiddleware,
    describeRoute({
      description:
        "List the current user's cookbooks, creating the top-level cookbook if needed.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(v.array(ownedCookbookSchema)) },
          },
          description: "Owned cookbooks returned.",
        },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      return c.json(await listOwnedCookbooks(c, c.var.user!.id));
    },
  )
  .post(
    "/",
    requireAuthMiddleware,
    describeRoute({
      description: "Create a custom cookbook from selected recipes.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(ownedCookbookSchema) },
          },
          description: "Cookbook created.",
        },
      },
    }),
    validator("json", createCookbookSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const input = c.req.valid("json");
      const timestamp = nowIso();
      const row: NewCookbookRow = {
        id: crypto.randomUUID(),
        userId: c.var.user!.id,
        kind: customKind,
        slug: await uniqueCookbookSlug(c, input.title),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        visibility: input.visibility ?? "private",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await c.var.db.insert(cookbooks).values(row);
      await replaceCookbookRecipes(c, row, c.var.user!.id, input.recipeIds ?? []);

      const cookbook = await getOwnedCookbook(c, c.var.user!.id, row.id);
      return cookbook
        ? c.json(cookbook, 201)
        : c.json({ error: "Cookbook could not be created" }, 500);
    },
  )
  .get(
    "/top-level",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Return the current user's top-level cookbook, creating it if needed.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(ownedCookbookSchema) },
          },
          description: "Owned top-level cookbook returned.",
        },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      return c.json(await getOwnedTopLevelCookbook(c, c.var.user!.id));
    },
  )
  .put(
    "/top-level",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Update the current user's top-level cookbook metadata and visibility.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(ownedCookbookSchema) },
          },
          description: "Top-level cookbook updated.",
        },
      },
    }),
    validator("json", updateCookbookSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const cookbook = await ensureTopLevelCookbook(c, c.var.user!.id);
      await updateCookbookRow(c, cookbook, c.var.user!.id, c.req.valid("json"), {
        allowRecipeIds: false,
      });
      return c.json(await getOwnedTopLevelCookbook(c, c.var.user!.id));
    },
  )
  .patch(
    "/:id",
    requireAuthMiddleware,
    describeRoute({
      description: "Update an owned cookbook.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(ownedCookbookSchema) },
          },
          description: "Cookbook updated.",
        },
        404: { description: "Cookbook not found." },
      },
    }),
    validator("param", cookbookIdParamSchema),
    validator("json", updateCookbookSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const { id } = c.req.valid("param");
      const cookbook = await getOwnedCookbookRow(c, c.var.user!.id, id);
      if (!cookbook) {
        return c.json({ error: "Cookbook not found" }, 404);
      }

      await updateCookbookRow(c, cookbook, c.var.user!.id, c.req.valid("json"), {
        allowRecipeIds: cookbook.kind !== topLevelKind,
      });

      const updated = await getOwnedCookbook(c, c.var.user!.id, id);
      return updated ? c.json(updated) : c.json({ error: "Cookbook not found" }, 404);
    },
  )
  .delete(
    "/:id",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Delete a custom cookbook. The top-level cookbook cannot be deleted.",
      responses: {
        204: { description: "Cookbook deleted." },
        400: { description: "Cannot delete the top-level cookbook." },
        404: { description: "Cookbook not found." },
      },
    }),
    validator("param", cookbookIdParamSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const cookbook = await getOwnedCookbookRow(
        c,
        c.var.user!.id,
        c.req.valid("param").id,
      );
      if (!cookbook) {
        return c.json({ error: "Cookbook not found" }, 404);
      }
      if (cookbook.kind === topLevelKind) {
        return c.json({ error: "The top-level cookbook cannot be deleted" }, 400);
      }

      await c.var.db.delete(cookbooks).where(eq(cookbooks.id, cookbook.id));
      return c.body(null, 204);
    },
  )
  .post(
    "/:slug/recipes/:recipeId/copy",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Copy a recipe that is accessible through a cookbook into the current user's recipes.",
      responses: {
        201: { description: "Recipe copied." },
        404: { description: "Recipe not found or not accessible through cookbook." },
      },
    }),
    validator("param", cookbookRecipeParamSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const { slug, recipeId } = c.req.valid("param");
      const result = await getCookbookRecipeBySlug(c, slug, recipeId, c.var.user!.id);
      if (!result) {
        return c.json({ error: "Recipe not found or not accessible" }, 404);
      }

      const copy = await c.var.store.create({
        title: result.recipe.title,
        description: result.recipe.description,
        imageUrl: result.recipe.imageUrl,
        images: result.recipe.images,
        source: result.recipe.source,
        prepTimeMinutes: result.recipe.prepTimeMinutes,
        cookTimeMinutes: result.recipe.cookTimeMinutes,
        totalTimeMinutes: result.recipe.totalTimeMinutes,
        servings: result.recipe.servings,
        tags: result.recipe.tags,
        ingredients: result.recipe.ingredients,
        steps: result.recipe.steps,
        notes: result.recipe.notes,
        visibility: "private",
      });
      return c.json(copy, 201);
    },
  )
  .get(
    "/:slug",
    describeRoute({
      description:
        "Resolve a cookbook by slug. Private cookbooks require owner access; unlisted and public cookbooks work by link.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(publicCookbookSchema) },
          },
          description: "Cookbook resolved.",
        },
        404: { description: "Cookbook not found or not accessible." },
      },
    }),
    validator("param", slugParamSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const cookbook = await getPublicCookbookBySlug(
        c,
        c.req.valid("param").slug,
        c.var.user?.id,
      );
      return cookbook
        ? c.json(cookbook)
        : c.json({ error: "Cookbook not found or not accessible" }, 404);
    },
  )
  .get(
    "/:slug/recipes/:recipeId",
    describeRoute({
      description:
        "Resolve a recipe through a cookbook. Cookbook visibility, not the recipe's standalone visibility, controls access.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(cookbookRecipeSchema) },
          },
          description: "Cookbook recipe resolved.",
        },
        404: { description: "Recipe not found or not accessible through cookbook." },
      },
    }),
    validator("param", cookbookRecipeParamSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Cookbooks require the DB binding" }, 503);
      }

      const { slug, recipeId } = c.req.valid("param");
      const result = await getCookbookRecipeBySlug(c, slug, recipeId, c.var.user?.id);
      return result
        ? c.json(result)
        : c.json({ error: "Recipe not found or not accessible" }, 404);
    },
  );

async function listOwnedCookbooks(
  c: Context<Env>,
  ownerId: string,
): Promise<OwnedCookbook[]> {
  await ensureTopLevelCookbook(c, ownerId);
  const rows = await c.var
    .db!.select()
    .from(cookbooks)
    .where(eq(cookbooks.userId, ownerId))
    .orderBy(desc(cookbooks.updatedAt));
  const sorted = rows.sort((left, right) => {
    if (left.kind === topLevelKind) return -1;
    if (right.kind === topLevelKind) return 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
  return Promise.all(sorted.map((row) => ownedCookbookFromRow(c, row, ownerId)));
}

async function getOwnedTopLevelCookbook(
  c: Context<Env>,
  ownerId: string,
): Promise<OwnedCookbook> {
  const cookbook = await ensureTopLevelCookbook(c, ownerId);
  return ownedCookbookFromRow(c, cookbook, ownerId);
}

async function getOwnedCookbook(
  c: Context<Env>,
  ownerId: string,
  cookbookId: string,
): Promise<OwnedCookbook | undefined> {
  const row = await getOwnedCookbookRow(c, ownerId, cookbookId);
  return row ? ownedCookbookFromRow(c, row, ownerId) : undefined;
}

async function getOwnedCookbookRow(
  c: Context<Env>,
  ownerId: string,
  cookbookId: string,
): Promise<CookbookRow | undefined> {
  return c.var
    .db!.select()
    .from(cookbooks)
    .where(and(eq(cookbooks.userId, ownerId), eq(cookbooks.id, cookbookId)))
    .get();
}

async function listPublicCookbooks(c: Context<Env>): Promise<PublicCookbook[]> {
  const rows = await c.var
    .db!.select()
    .from(cookbooks)
    .where(eq(cookbooks.visibility, "public"))
    .orderBy(desc(cookbooks.updatedAt));

  const publicCookbooks = await Promise.all(
    rows.map((row) => publicCookbookFromRow(c, row)),
  );
  return publicCookbooks.filter((cookbook): cookbook is PublicCookbook =>
    Boolean(cookbook),
  );
}

async function ownedCookbookFromRow(
  c: Context<Env>,
  row: CookbookRow,
  ownerId: string,
): Promise<OwnedCookbook> {
  if (row.kind === topLevelKind) {
    await syncTopLevelCookbookRecipes(c, row.id, ownerId);
  }
  const memberships = await c.var
    .db!.select()
    .from(cookbookRecipes)
    .where(eq(cookbookRecipes.cookbookId, row.id))
    .orderBy(cookbookRecipes.position);

  return {
    ...cookbookFromRow(row),
    recipeIds: memberships.map((membership) => membership.recipeId),
  };
}

async function updateCookbookRow(
  c: Context<Env>,
  cookbook: CookbookRow,
  ownerId: string,
  input: v.InferOutput<typeof updateCookbookSchema>,
  options: { allowRecipeIds: boolean },
) {
  const updatedAt = nowIso();
  await c.var
    .db!.update(cookbooks)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
      updatedAt,
    })
    .where(eq(cookbooks.id, cookbook.id));

  if (options.allowRecipeIds && input.recipeIds) {
    await replaceCookbookRecipes(c, cookbook, ownerId, input.recipeIds);
  }
}

async function getTopLevelPublicCookbook(
  c: Context<Env>,
  ownerId: string,
  viewerId?: string,
): Promise<PublicCookbook | undefined> {
  const cookbook = await getAccessibleTopLevelCookbook(c, ownerId, viewerId);
  return cookbook ? publicCookbookFromRow(c, cookbook, viewerId) : undefined;
}

async function getPublicCookbookBySlug(
  c: Context<Env>,
  slug: string,
  viewerId?: string,
): Promise<PublicCookbook | undefined> {
  const row = await c.var
    .db!.select()
    .from(cookbooks)
    .where(eq(cookbooks.slug, slug))
    .get();
  if (!row) {
    return undefined;
  }

  const canView = row.visibility !== "private" || viewerId === row.userId;
  return canView ? publicCookbookFromRow(c, row, viewerId) : undefined;
}

async function getCookbookRecipeBySlug(
  c: Context<Env>,
  slug: string,
  recipeId: string,
  viewerId?: string,
): Promise<CookbookRecipe | undefined> {
  const cookbook = await getPublicCookbookBySlug(c, slug, viewerId);
  const recipe = cookbook?.recipes.find((item) => item.id === recipeId);
  return cookbook && recipe ? { cookbook, recipe } : undefined;
}

async function publicCookbookFromRow(
  c: Context<Env>,
  cookbook: CookbookRow,
  _viewerId?: string,
): Promise<PublicCookbook | undefined> {
  if (cookbook.kind === topLevelKind) {
    await syncTopLevelCookbookRecipes(c, cookbook.id, cookbook.userId);
  }

  const owner = await c.var
    .db!.select(ownerColumns)
    .from(user)
    .where(eq(user.id, cookbook.userId))
    .get();
  if (!owner) {
    return undefined;
  }

  return {
    ...cookbookFromRow(cookbook),
    owner: toOwner(owner),
    recipes: await listCookbookRecipes(c, cookbook.id),
  };
}

async function getAccessibleTopLevelCookbook(
  c: Context<Env>,
  ownerId: string,
  viewerId?: string,
): Promise<CookbookRow | undefined> {
  const cookbook =
    viewerId === ownerId
      ? await ensureTopLevelCookbook(c, ownerId)
      : await getTopLevelCookbookRow(c, ownerId);
  if (!cookbook) {
    return undefined;
  }

  const canView = cookbook.visibility !== "private" || viewerId === ownerId;
  return canView ? cookbook : undefined;
}

async function ensureTopLevelCookbook(
  c: Context<Env>,
  ownerId: string,
): Promise<CookbookRow> {
  const owner = await c.var
    .db!.select(ownerColumns)
    .from(user)
    .where(eq(user.id, ownerId))
    .get();
  const ownerName = owner?.name ?? "OpenCook";
  const legacyTopLevelTitle = `${ownerName}'s cookbook`;
  const existing = await getTopLevelCookbookRow(c, ownerId);
  if (existing) {
    const shouldRenameTitle = existing.title === legacyTopLevelTitle;
    const shouldSetDescription =
      existing.title === legacyTopLevelTitle || existing.title === topLevelDefaultTitle
        ? !existing.description?.trim()
        : false;

    if (shouldRenameTitle || shouldSetDescription) {
      const updated = await c.var
        .db!
        .update(cookbooks)
        .set({
          ...(shouldRenameTitle ? { title: topLevelDefaultTitle } : {}),
          ...(shouldSetDescription ? { description: topLevelDefaultDescription } : {}),
          updatedAt: nowIso(),
        })
        .where(eq(cookbooks.id, existing.id))
        .returning()
        .get();
      if (updated) {
        await syncTopLevelCookbookRecipes(c, updated.id, ownerId);
        return updated;
      }
    }
    await syncTopLevelCookbookRecipes(c, existing.id, ownerId);
    return existing;
  }

  const timestamp = nowIso();
  const row: NewCookbookRow = {
    id: crypto.randomUUID(),
    userId: ownerId,
    kind: topLevelKind,
    slug: await uniqueCookbookSlug(c, `${ownerName} cookbook`),
    title: topLevelDefaultTitle,
    description: topLevelDefaultDescription,
    visibility: "private",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await c.var.db!.insert(cookbooks).values(row).onConflictDoNothing();
  const created = await getTopLevelCookbookRow(c, ownerId);
  if (!created) {
    throw new Error("Top-level cookbook could not be created.");
  }
  await syncTopLevelCookbookRecipes(c, created.id, ownerId);
  return created;
}

async function getTopLevelCookbookRow(
  c: Context<Env>,
  ownerId: string,
): Promise<CookbookRow | undefined> {
  return c.var
    .db!.select()
    .from(cookbooks)
    .where(and(eq(cookbooks.userId, ownerId), eq(cookbooks.kind, topLevelKind)))
    .get();
}

async function syncTopLevelCookbookRecipes(
  c: Context<Env>,
  cookbookId: string,
  ownerId: string,
) {
  const rows = await c.var
    .db!.select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.userId, ownerId))
    .orderBy(recipes.title);
  if (!rows.length) {
    return;
  }

  const addedAt = nowIso();
  for (const [position, row] of rows.entries()) {
    await c.var
      .db!.insert(cookbookRecipes)
      .values({
        cookbookId,
        recipeUserId: ownerId,
        recipeId: row.id,
        position,
        addedAt,
      })
      .onConflictDoNothing();
  }
}

async function replaceCookbookRecipes(
  c: Context<Env>,
  cookbook: Pick<CookbookRow, "id">,
  ownerId: string,
  recipeIds: string[],
) {
  const uniqueRecipeIds = [...new Set(recipeIds)];
  await c.var
    .db!.delete(cookbookRecipes)
    .where(eq(cookbookRecipes.cookbookId, cookbook.id));
  if (!uniqueRecipeIds.length) {
    return;
  }

  const ownedRecipes = await c.var
    .db!.select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.userId, ownerId), inArray(recipes.id, uniqueRecipeIds)));
  const ownedIds = new Set(ownedRecipes.map((recipe) => recipe.id));
  const addedAt = nowIso();
  const rows = uniqueRecipeIds
    .filter((recipeId) => ownedIds.has(recipeId))
    .map((recipeId, position) => ({
      cookbookId: cookbook.id,
      recipeUserId: ownerId,
      recipeId,
      position,
      addedAt,
    }));
  if (rows.length) {
    await c.var.db!.insert(cookbookRecipes).values(rows);
  }
}

async function listCookbookRecipes(
  c: Context<Env>,
  cookbookId: string,
): Promise<SharedRecipe[]> {
  const rows = await c.var
    .db!.select({
      owner: ownerColumns,
      recipe: recipes,
    })
    .from(cookbookRecipes)
    .innerJoin(
      recipes,
      and(
        eq(recipes.userId, cookbookRecipes.recipeUserId),
        eq(recipes.id, cookbookRecipes.recipeId),
      ),
    )
    .innerJoin(user, eq(user.id, recipes.userId))
    .where(eq(cookbookRecipes.cookbookId, cookbookId))
    .orderBy(cookbookRecipes.position, recipes.title);

  return rows.map((row) => ({
    ...rowToRecipe(row.recipe),
    owner: toOwner(row.owner),
  }));
}

async function uniqueCookbookSlug(c: Context<Env>, title: string) {
  const base = slugBase(title) || "cookbook";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 5)}`;
    const existing = await c.var
      .db!.select({ id: cookbooks.id })
      .from(cookbooks)
      .where(eq(cookbooks.slug, slug))
      .get();
    if (!existing) {
      return slug;
    }
  }
  return `${base}-${crypto.randomUUID().slice(0, slugSuffixLength)}`;
}

function slugBase(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function cookbookFromRow(row: CookbookRow): Cookbook {
  return {
    id: row.id,
    kind: row.kind,
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    visibility: row.visibility as CookbookVisibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
