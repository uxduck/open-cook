import { parseRecipeMarkdown, recipeSchema, structureRecipe } from "@open-cook/core";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import { mirrorRecipeImages, mirrorRecipeInputImage } from "../../assets/imageAssets";
import { requireAuthMiddleware } from "../auth/requireAuth";
import { structureRecipeWithAi } from "../structure/recipeStructuring";
import { importStashCookRecipes, mapStashCookRows } from "./stashCookImporter";
import { importRecipeFromWebsite } from "./websiteImporter";

const markdownImportSchema = v.object({
  markdown: v.pipe(v.string(), v.minLength(1)),
});

const stashCookImportSchema = v.object({
  baseUrl: v.optional(v.pipe(v.string(), v.url())),
  bearerToken: v.optional(v.string()),
  cookie: v.optional(v.string()),
  take: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(200))),
  includeDeleted: v.optional(v.boolean()),
});

const stashCookExportImportSchema = v.object({
  recipes: v.pipe(v.array(v.unknown()), v.minLength(1)),
});

const websiteImportSchema = v.object({
  url: v.pipe(v.string(), v.url()),
});

const importResultSchema = v.object({
  created: v.number(),
  updated: v.number(),
  recipes: v.array(recipeSchema),
});

export const importApp = new Hono<Env>()
  .use("*", requireAuthMiddleware)
  .post(
    "/markdown",
    describeRoute({
      description: "Import one recipe from OpenCook Markdown.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(recipeSchema) },
          },
          description: "Recipe imported.",
        },
      },
    }),
    validator("json", markdownImportSchema),
    async (c) => {
      const input = await mirrorRecipeInputImage(
        parseRecipeMarkdown(c.req.valid("json").markdown),
        c.var.assets,
      );
      const recipe = await c.var.store.create(input);
      const structured = await structureRecipeWithAi(recipe, {
        ai: c.env.AI,
      });
      const updated =
        (await c.var.store.update(recipe.id, {
          ingredients: structured.ingredients,
          steps: structured.steps,
        })) ?? structured;
      return c.json(updated, 201);
    },
  )
  .post(
    "/website",
    describeRoute({
      description:
        "Fetch a public recipe page, import schema.org Recipe JSON-LD, and fall back to Workers AI extraction when configured.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(recipeSchema) },
          },
          description: "Recipe imported.",
        },
        422: { description: "No recipe data could be extracted." },
      },
    }),
    validator("json", websiteImportSchema),
    async (c) => {
      try {
        const importedRecipe = await importRecipeFromWebsite(c.req.valid("json"), {
          ai: c.env.AI,
        });
        const structuredRecipe = await structureRecipeWithAi(importedRecipe, {
          ai: c.env.AI,
        });
        const mirroredRecipes = await mirrorRecipeImages(
          [structuredRecipe],
          c.var.assets,
        );
        const recipe = mirroredRecipes[0];
        if (!recipe) {
          throw new Error("Website import returned no recipe.");
        }
        await c.var.store.upsertMany([recipe]);
        return c.json(recipe, 201);
      } catch (error) {
        return c.json(
          { error: error instanceof Error ? error.message : "Import failed" },
          422,
        );
      }
    },
  )
  .post(
    "/stashcook",
    describeRoute({
      description:
        "Import recipes from your own authenticated StashCook account using a bearer token or cookie copied from your browser session.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(importResultSchema) },
          },
          description: "StashCook recipes imported.",
        },
        401: { description: "Missing or invalid StashCook credentials." },
        422: { description: "StashCook import failed." },
      },
    }),
    validator("json", stashCookImportSchema),
    async (c) => {
      try {
        const importedRecipes = (await importStashCookRecipes(c.req.valid("json"))).map(
          structureRecipe,
        );
        const recipes = await mirrorRecipeImages(importedRecipes, c.var.assets);
        const result = await c.var.store.upsertMany(recipes);
        return c.json(result);
      } catch (error) {
        return c.json(
          { error: error instanceof Error ? error.message : "Import failed" },
          422,
        );
      }
    },
  )
  .post(
    "/stashcook/export",
    describeRoute({
      description:
        "Import recipes from a local StashCook recipes.json export without sending StashCook credentials to OpenCook.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(importResultSchema) },
          },
          description: "StashCook export recipes imported.",
        },
        422: { description: "StashCook export import failed." },
      },
    }),
    validator("json", stashCookExportImportSchema),
    async (c) => {
      try {
        const importedRecipes = mapStashCookRows(c.req.valid("json").recipes).map(
          structureRecipe,
        );
        const recipes = await mirrorRecipeImages(importedRecipes, c.var.assets);
        const result = await c.var.store.upsertMany(recipes);
        return c.json(result);
      } catch (error) {
        return c.json(
          { error: error instanceof Error ? error.message : "Import failed" },
          422,
        );
      }
    },
  );
