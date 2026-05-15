import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";

const manifestSchema = v.object({
  name: v.string(),
  openapiPath: v.string(),
  recommendedUse: v.array(v.string()),
  workflows: v.array(
    v.object({
      method: v.string(),
      path: v.string(),
      description: v.string(),
    }),
  ),
});

const shoppingListInputSchema = v.object({
  recipeIds: v.optional(v.array(v.string())),
});

const shoppingListOutputSchema = v.object({
  recipeCount: v.number(),
  items: v.array(
    v.object({
      text: v.string(),
      recipes: v.array(v.string()),
    }),
  ),
});

export const agentApp = new Hono<Env>()
  .get(
    "/manifest",
    describeRoute({
      description:
        "Explain the OpenCook API surfaces that are useful for Codex and other AI agents.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(manifestSchema) },
          },
          description: "Agent manifest returned.",
        },
      },
    }),
    (c) =>
      c.json({
        name: "OpenCook Agent API",
        openapiPath: "/openapi.json",
        recommendedUse: [
          "Ask Codex to inspect /openapi.json before calling endpoints.",
          "Use /api/recipes for direct user-owned recipe reads and edits.",
          "Use /api/import/* to bring data in from StashCook, Markdown, or recipe websites.",
          "Use /api/assets/images/* when workflows need public recipe images owned in R2.",
          "Use /api/export/* when a workflow needs portable JSON or Markdown output.",
        ],
        workflows: [
          {
            method: "POST",
            path: "/api/agents/workflows/shopping-list",
            description:
              "Generate a plain shopping list from selected recipe ingredients.",
          },
          {
            method: "POST",
            path: "/api/assets/images/mirror-recipes",
            description:
              "Copy existing recipe image URLs into public Cloudflare R2 and update the recipes.",
          },
        ],
      }),
  )
  .post(
    "/workflows/shopping-list",
    describeRoute({
      description:
        "Create a simple shopping list from all recipes or a selected set of recipe ids.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(shoppingListOutputSchema) },
          },
          description: "Shopping list generated.",
        },
      },
    }),
    validator("json", shoppingListInputSchema),
    async (c) => {
      const { recipeIds } = c.req.valid("json");
      const recipes = recipeIds?.length
        ? (await Promise.all(recipeIds.map((id) => c.var.store.get(id)))).filter(
            (recipe) => recipe !== undefined,
          )
        : await c.var.store.list();

      const byIngredient = new Map<string, { text: string; recipes: string[] }>();

      for (const recipe of recipes) {
        for (const ingredient of recipe.ingredients) {
          const key = ingredient.text.toLowerCase();
          const item = byIngredient.get(key) ?? {
            text: ingredient.text,
            recipes: [],
          };
          item.recipes.push(recipe.title);
          byIngredient.set(key, item);
        }
      }

      return c.json({
        recipeCount: recipes.length,
        items: [...byIngredient.values()].sort((a, b) => a.text.localeCompare(b.text)),
      });
    },
  );
