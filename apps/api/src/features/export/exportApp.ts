import { recipesToMarkdown, recipeToMarkdown } from "@open-cook/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import type { Env } from "../../AppContext";

export const exportApp = new Hono<Env>()
  .get(
    "/recipes/json",
    describeRoute({
      description: "Export all recipes as OpenCook JSON.",
      responses: { 200: { description: "JSON export returned." } },
    }),
    async (c) => c.json({ recipes: await c.var.store.list() }),
  )
  .get(
    "/recipes/markdown",
    describeRoute({
      description: "Export all recipes as Markdown.",
      responses: { 200: { description: "Markdown export returned." } },
    }),
    async (c) =>
      c.text(recipesToMarkdown(await c.var.store.list()), 200, {
        "content-type": "text/markdown; charset=utf-8",
      }),
  )
  .get(
    "/recipes/:id/markdown",
    describeRoute({
      description: "Export one recipe as Markdown.",
      responses: {
        200: { description: "Markdown export returned." },
        404: { description: "Recipe not found." },
      },
    }),
    async (c) => {
      const id = c.req.param("id");
      if (!id) {
        return c.json({ error: "Recipe not found" }, 404);
      }

      const recipe = await c.var.store.get(id);
      return recipe
        ? c.text(recipeToMarkdown(recipe), 200, {
            "content-type": "text/markdown; charset=utf-8",
          })
        : c.json({ error: "Recipe not found" }, 404);
    },
  );
