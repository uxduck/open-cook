import type { PublicGathering, RecipeSource, SharedRecipe } from "@open-cook/core";
import { createServerFn } from "@tanstack/react-start";
import { fetchApiPath } from "./apiProxy";

type LinkRecipe = Omit<SharedRecipe, "source"> & {
  source?: Omit<RecipeSource, "raw"> & { raw?: Record<string, string> };
};

export type LinkPublicGathering = Omit<PublicGathering, "recipes"> & {
  recipes: LinkRecipe[];
};

export const getPublicGathering = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<LinkPublicGathering | null> => {
    const response = await fetchApiPath(
      `/api/gatherings/${encodeURIComponent(data.slug)}`,
    ).catch(() => null);
    if (!response?.ok) {
      return null;
    }
    return (await response.json()) as LinkPublicGathering;
  });
