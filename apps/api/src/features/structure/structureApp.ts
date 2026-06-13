import { recipeSchema } from "@open-cook/core";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import { requireAuthMiddleware } from "../auth/requireAuth";
import { recipeStructureSummary, structureRecipeWithAi } from "./recipeStructuring";

const structureRecipeInputSchema = v.object({
  recipe: recipeSchema,
});

const structureRecipeOutputSchema = v.object({
  recipe: recipeSchema,
  summary: v.object({
    ingredients: v.number(),
    steps: v.number(),
    warnings: v.array(v.string()),
  }),
});

export const structureApp = new Hono<Env>().use("*", requireAuthMiddleware).post(
  "/recipe",
  describeRoute({
    description:
      "Structure a recipe's ingredient quantities and method metadata for scaling and import review. Uses Workers AI when configured and deterministic parsing as fallback.",
    responses: {
      200: {
        content: {
          "application/json": { schema: resolver(structureRecipeOutputSchema) },
        },
        description: "Structured recipe returned.",
      },
    },
  }),
  validator("json", structureRecipeInputSchema),
  async (c) => {
    const { recipe } = c.req.valid("json");
    const structured = await structureRecipeWithAi(recipe, {
      ai: c.env.AI,
    });

    return c.json({
      recipe: structured,
      summary: recipeStructureSummary(structured),
    });
  },
);
