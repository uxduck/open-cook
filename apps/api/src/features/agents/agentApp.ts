import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import { requireAuthMiddleware } from "../auth/requireAuth";
import { searchRecipeSummaries } from "./recipeSearchTool";

const agentEndpointSchema = v.object({
  method: v.string(),
  path: v.string(),
  description: v.string(),
});

const manifestSchema = v.object({
  name: v.string(),
  openapiPath: v.string(),
  recommendedUse: v.array(v.string()),
  tools: v.array(agentEndpointSchema),
  workflows: v.array(agentEndpointSchema),
});

const recipeSearchInputSchema = v.object({
  q: v.optional(v.string()),
  tag: v.optional(v.string()),
  source: v.optional(v.string()),
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(25))),
  includeIngredients: v.optional(v.boolean()),
  includeSteps: v.optional(v.boolean()),
});

const recipeSearchOutputSchema = v.object({
  query: v.object({
    q: v.optional(v.string()),
    tag: v.optional(v.string()),
    source: v.optional(v.string()),
    limit: v.number(),
  }),
  count: v.number(),
  returned: v.number(),
  recipes: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      servings: v.optional(v.string()),
      totalTimeMinutes: v.optional(v.number()),
      tags: v.array(v.string()),
      source: v.optional(
        v.object({
          name: v.optional(v.string()),
          url: v.optional(v.string()),
          externalId: v.optional(v.string()),
        }),
      ),
      matchedFields: v.array(v.string()),
      ingredientMatches: v.array(v.string()),
      score: v.number(),
      ingredients: v.optional(v.array(v.string())),
      steps: v.optional(v.array(v.string())),
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
          "Use /api/agents/tools/search-recipes for compact ranked recipe discovery.",
          "Use /api/recipes for direct user-owned recipe reads and edits.",
          "Use /api/import/* to bring data in from StashCook, Markdown, or recipe websites.",
          "Use /api/assets/images/* when workflows need public recipe images owned in R2.",
          "Use /api/ai/recipes/remix to generate draft recipe remixes through the API Worker's Workers AI binding.",
          "Use /api/ai/images/recipe to generate and store recipe images through the API Worker's Workers AI binding.",
          "Use /api/export/* when a workflow needs portable JSON or Markdown output.",
        ],
        tools: [
          {
            method: "POST",
            path: "/api/agents/tools/search-recipes",
            description:
              "Search recipes with compact ranked results before fetching full recipe records.",
          },
          {
            method: "POST",
            path: "/api/ai/recipes/remix",
            description:
              "Generate a recipe draft remix from a stored recipe id or explicit recipe payload.",
          },
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
            path: "/api/structure/recipe",
            description:
              "Structure one recipe's ingredients and method steps for serving scaling and import review.",
          },
          {
            method: "POST",
            path: "/api/assets/images/mirror-recipes",
            description:
              "Copy existing recipe image URLs into public Cloudflare R2 and update the recipes.",
          },
          {
            method: "POST",
            path: "/api/ai/images/recipe",
            description:
              "Generate a recipe image from a recipe draft and store the bytes in public R2.",
          },
        ],
      }),
  )
  .post(
    "/tools/search-recipes",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Search recipes for agent use. Returns bounded summaries, ranking metadata, and optional ingredient or step previews.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(recipeSearchOutputSchema) },
          },
          description: "Recipe search results returned.",
        },
        400: { description: "Invalid search payload." },
      },
    }),
    validator("json", recipeSearchInputSchema),
    async (c) => {
      const input = c.req.valid("json");
      const recipes = await c.var.store.list({
        q: input.q,
        tag: input.tag,
        source: input.source,
      });
      return c.json(searchRecipeSummaries(recipes, input));
    },
  )
  .post(
    "/workflows/shopping-list",
    requireAuthMiddleware,
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
