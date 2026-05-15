import {
  createRecipeSchema,
  recipeIdParamSchema,
  recipeListQuerySchema,
  recipeSchema,
  updateRecipeSchema,
} from "@open-cook/core";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import { mirrorRecipeInputImage } from "../../assets/imageAssets";

export const recipeApp = new Hono<Env>()
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
      },
    }),
    validator("json", createRecipeSchema),
    async (c) => {
      const input = await mirrorRecipeInputImage(c.req.valid("json"), c.var.assets);
      return c.json(await c.var.store.create(input), 201);
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
