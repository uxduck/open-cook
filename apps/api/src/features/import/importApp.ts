import { parseRecipeMarkdown, recipeSchema } from "@open-cook/core";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import { mirrorRecipeImages, mirrorRecipeInputImage } from "../../assets/imageAssets";
import { importStashCookRecipes } from "./stashCookImporter";
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

const websiteImportSchema = v.object({
  url: v.pipe(v.string(), v.url()),
});

const importResultSchema = v.object({
  created: v.number(),
  updated: v.number(),
  recipes: v.array(recipeSchema),
});

export const importApp = new Hono<Env>()
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
      return c.json(recipe, 201);
    },
  )
  .post(
    "/website",
    describeRoute({
      description: "Fetch a public recipe page and import schema.org Recipe JSON-LD.",
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
        const importedRecipe = await importRecipeFromWebsite(c.req.valid("json"));
        const mirroredRecipes = await mirrorRecipeImages(
          [importedRecipe],
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
        const importedRecipes = await importStashCookRecipes(c.req.valid("json"));
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
