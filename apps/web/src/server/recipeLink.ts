import type { RecipeSource, SharedRecipe } from "@open-cook/core";
import { createServerFn } from "@tanstack/react-start";
import { fetchApiPath } from "./apiProxy";

export type RecipeLinkInput = { ownerId: string; recipeId: string };

// SharedRecipe's `source.raw` is Record<string, unknown>, and TanStack's server-fn
// return-type serialization check rejects `unknown`. The payload is JSON either way,
// so we model the (unused-here) raw blob as JSON-safe to satisfy the type checker.
type LinkRecipe = Omit<SharedRecipe, "source"> & {
  source?: Omit<RecipeSource, "raw"> & { raw?: Record<string, string> };
};

// Server-only fetch of a shareable recipe. Runs during SSR (and via RPC on
// client navigation), reaching the API Worker through the Cloudflare service
// binding, a configured API origin, or the local API dev server.
export const getRecipeLink = createServerFn({ method: "GET" })
  .validator((input: RecipeLinkInput) => input)
  .handler(async ({ data }): Promise<LinkRecipe | null> => {
    const path = `/api/recipes/link/${encodeURIComponent(data.ownerId)}/${encodeURIComponent(
      data.recipeId,
    )}`;
    const response = await fetchApiPath(path).catch(() => null);
    if (!response?.ok) {
      return null;
    }
    return (await response.json()) as LinkRecipe;
  });
