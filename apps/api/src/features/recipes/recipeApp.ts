import {
  createRecipeSchema,
  recipeCookProgressInputSchema,
  recipeCookProgressSchema,
  recipeIdParamSchema,
  recipeListQuerySchema,
  recipeSchema,
  recipeShareSchema,
  sharedRecipeSchema,
  updateRecipeSchema,
} from "@open-cook/core";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import { mirrorRecipeInputImage } from "../../assets/imageAssets";
import { getRecipeByLink, listPublicRecipes } from "../../storage/d1RecipeStore";
import { requireAuthMiddleware } from "../auth/requireAuth";
import { isFreePlan, RECIPE_LIMIT_FREE } from "../billing/entitlements";

export const recipeApp = new Hono<Env>()
  .get(
    "/link/:ownerId/:id",
    describeRoute({
      description:
        "Resolve a recipe share link. Works without a session for public and unlisted recipes.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(sharedRecipeSchema) },
          },
          description: "Recipe resolved from the share link.",
        },
        404: { description: "Recipe not found or not accessible." },
      },
    }),
    validator(
      "param",
      v.object({
        ownerId: v.pipe(v.string(), v.minLength(1)),
        id: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    async (c) => {
      if (!c.env.DB) {
        return c.json({ error: "Recipe not found" }, 404);
      }
      const { ownerId, id } = c.req.valid("param");
      const recipe = await getRecipeByLink(c.env.DB, ownerId, id, c.var.user?.id);
      return recipe
        ? c.json(recipe)
        : c.json({ error: "Recipe not found or not accessible" }, 404);
    },
  )
  .get(
    "/public",
    describeRoute({
      description: "List recipes any user has made public. No session required.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(v.array(sharedRecipeSchema)) },
          },
          description: "Public recipes retrieved successfully.",
        },
      },
    }),
    validator("query", recipeListQuerySchema),
    async (c) => {
      const filters = c.req.valid("query");
      if (c.env.DB) {
        return c.json(await listPublicRecipes(c.env.DB, filters));
      }
      return c.json(await c.var.store.listPublic(filters));
    },
  )
  .use("*", requireAuthMiddleware)
  .get(
    "/",
    describeRoute({
      description: "List recipes in the local OpenCook store.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(v.array(recipeSchema)) },
          },
          description: "Recipes retrieved successfully.",
        },
      },
    }),
    validator("query", recipeListQuerySchema),
    async (c) => c.json(await c.var.store.list(c.req.valid("query"))),
  )
  .post(
    "/",
    describeRoute({
      description: "Create a recipe in the local OpenCook store.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(recipeSchema) },
          },
          description: "Recipe created successfully.",
        },
        400: { description: "Invalid recipe payload." },
        402: { description: "Free-plan recipe limit reached." },
      },
    }),
    validator("json", createRecipeSchema),
    async (c) => {
      if (isFreePlan(c.var.user) && (await c.var.store.count()) >= RECIPE_LIMIT_FREE) {
        return c.json(
          {
            error: `Free plan is limited to ${RECIPE_LIMIT_FREE} recipes. Upgrade to Chef for unlimited.`,
            reason: "recipe_limit",
            limit: RECIPE_LIMIT_FREE,
          },
          402,
        );
      }
      const input = await mirrorRecipeInputImage(c.req.valid("json"), c.var.assets);
      return c.json(await c.var.store.create(input), 201);
    },
  )
  .get(
    "/shared-with-me",
    describeRoute({
      description: "List recipes other users have shared with the current user.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(v.array(sharedRecipeSchema)) },
          },
          description: "Shared recipes retrieved successfully.",
        },
      },
    }),
    async (c) => c.json(await c.var.store.listSharedWithMe()),
  )
  .post(
    "/shared-with-me/:ownerId/:id/seen",
    describeRoute({
      description: "Mark a recipe shared with the current user as seen.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(sharedRecipeSchema) },
          },
          description: "Shared recipe marked seen.",
        },
        404: { description: "Shared recipe not found." },
      },
    }),
    validator(
      "param",
      v.object({
        ownerId: v.pipe(v.string(), v.minLength(1)),
        id: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    async (c) => {
      const { ownerId, id } = c.req.valid("param");
      const recipe = await c.var.store.markShareSeen(ownerId, id);
      return recipe ? c.json(recipe) : c.json({ error: "Share not found" }, 404);
    },
  )
  .delete(
    "/shared-with-me/:ownerId/:id",
    describeRoute({
      description: "Dismiss a recipe shared with the current user from their inbox.",
      responses: {
        204: { description: "Shared recipe dismissed." },
        404: { description: "Shared recipe not found." },
      },
    }),
    validator(
      "param",
      v.object({
        ownerId: v.pipe(v.string(), v.minLength(1)),
        id: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    async (c) => {
      const { ownerId, id } = c.req.valid("param");
      const dismissed = await c.var.store.dismissShare(ownerId, id);
      return dismissed ? c.body(null, 204) : c.json({ error: "Share not found" }, 404);
    },
  )
  .post(
    "/copy",
    describeRoute({
      description: "Copy a public or shared recipe into the current user's collection.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(recipeSchema) },
          },
          description: "Recipe copied successfully.",
        },
        404: { description: "Recipe not found or not accessible." },
      },
    }),
    validator(
      "json",
      v.object({
        ownerId: v.pipe(v.string(), v.minLength(1)),
        recipeId: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    async (c) => {
      const { ownerId, recipeId } = c.req.valid("json");
      const copy = await c.var.store.copyFrom(ownerId, recipeId);
      return copy
        ? c.json(copy, 201)
        : c.json({ error: "Recipe not found or not accessible" }, 404);
    },
  )
  .get(
    "/:id/shares",
    describeRoute({
      description: "List the users a recipe is shared with.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(v.array(recipeShareSchema)) },
          },
          description: "Shares retrieved successfully.",
        },
        404: { description: "Recipe not found." },
      },
    }),
    validator("param", recipeIdParamSchema),
    async (c) => {
      const shares = await c.var.store.listShares(c.req.valid("param").id);
      return shares ? c.json(shares) : c.json({ error: "Recipe not found" }, 404);
    },
  )
  .post(
    "/:id/shares",
    describeRoute({
      description: "Share a recipe with another user by email or username.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(recipeShareSchema) },
          },
          description: "Recipe shared successfully.",
        },
        400: { description: "Cannot share a recipe with yourself." },
        404: { description: "Recipe or user not found." },
      },
    }),
    validator("param", recipeIdParamSchema),
    validator("json", v.object({ identifier: v.pipe(v.string(), v.minLength(1)) })),
    async (c) => {
      const result = await c.var.store.share(
        c.req.valid("param").id,
        c.req.valid("json").identifier,
      );
      if (result.ok) {
        return c.json(result.share, 201);
      }
      if (result.reason === "recipe_not_found") {
        return c.json({ error: "Recipe not found" }, 404);
      }
      if (result.reason === "user_not_found") {
        return c.json({ error: "No user found with that email or username" }, 404);
      }
      return c.json({ error: "You already have this recipe" }, 400);
    },
  )
  .delete(
    "/:id/shares/:userId",
    describeRoute({
      description: "Stop sharing a recipe with a user.",
      responses: {
        204: { description: "Share removed." },
        404: { description: "Share not found." },
      },
    }),
    validator(
      "param",
      v.object({
        id: v.pipe(v.string(), v.minLength(1)),
        userId: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    async (c) => {
      const { id, userId } = c.req.valid("param");
      const removed = await c.var.store.unshare(id, userId);
      return removed ? c.body(null, 204) : c.json({ error: "Share not found" }, 404);
    },
  )
  .get(
    "/:id/progress",
    describeRoute({
      description:
        "Get the current user's private cook-session checklist for an owned recipe.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(recipeCookProgressSchema) },
          },
          description: "Private cook progress retrieved.",
        },
        404: { description: "Recipe not found." },
      },
    }),
    validator("param", recipeIdParamSchema),
    async (c) => {
      const progress = await c.var.store.getCookProgress(c.req.valid("param").id);
      return progress ? c.json(progress) : c.json({ error: "Recipe not found" }, 404);
    },
  )
  .put(
    "/:id/progress",
    describeRoute({
      description:
        "Update the current user's private cook-session checklist for an owned recipe.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(recipeCookProgressSchema) },
          },
          description: "Private cook progress updated.",
        },
        400: { description: "Invalid progress payload." },
        404: { description: "Recipe not found." },
      },
    }),
    validator("param", recipeIdParamSchema),
    validator("json", recipeCookProgressInputSchema),
    async (c) => {
      const progress = await c.var.store.updateCookProgress(
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      return progress ? c.json(progress) : c.json({ error: "Recipe not found" }, 404);
    },
  )
  .delete(
    "/:id/progress",
    describeRoute({
      description:
        "Reset the current user's private cook-session checklist for an owned recipe.",
      responses: {
        204: { description: "Private cook progress reset." },
        404: { description: "Recipe not found." },
      },
    }),
    validator("param", recipeIdParamSchema),
    async (c) => {
      const reset = await c.var.store.resetCookProgress(c.req.valid("param").id);
      return reset ? c.body(null, 204) : c.json({ error: "Recipe not found" }, 404);
    },
  )
  .get(
    "/:id",
    describeRoute({
      description: "Get a recipe by id.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(recipeSchema) },
          },
          description: "Recipe found.",
        },
        404: { description: "Recipe not found." },
      },
    }),
    validator("param", recipeIdParamSchema),
    async (c) => {
      const recipe = await c.var.store.get(c.req.valid("param").id);
      return recipe ? c.json(recipe) : c.json({ error: "Recipe not found" }, 404);
    },
  )
  .put(
    "/:id",
    describeRoute({
      description: "Update a recipe by id.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(recipeSchema) },
          },
          description: "Recipe updated.",
        },
        400: { description: "Invalid recipe payload." },
        404: { description: "Recipe not found." },
      },
    }),
    validator("param", recipeIdParamSchema),
    validator("json", updateRecipeSchema),
    async (c) => {
      const id = c.req.valid("param").id;
      const input = await mirrorRecipeInputImage(c.req.valid("json"), c.var.assets, {
        recipeId: id,
      });
      const recipe = await c.var.store.update(id, input);
      return recipe ? c.json(recipe) : c.json({ error: "Recipe not found" }, 404);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      description: "Delete a recipe by id.",
      responses: {
        204: { description: "Recipe deleted." },
        404: { description: "Recipe not found." },
      },
    }),
    validator("param", recipeIdParamSchema),
    async (c) => {
      const deleted = await c.var.store.delete(c.req.valid("param").id);
      return deleted ? c.body(null, 204) : c.json({ error: "Recipe not found" }, 404);
    },
  );
