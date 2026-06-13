import type { PublicCookbook, RecipeSource, SharedRecipe } from "@open-cook/core";
import { createServerFn } from "@tanstack/react-start";
import { fetchApiPath } from "./apiProxy";

export type CookbookInput = { slug: string };
export type CookbookRecipeInput = { recipeId: string; slug: string };

type LinkRecipe = Omit<SharedRecipe, "source"> & {
  source?: Omit<RecipeSource, "raw"> & { raw?: Record<string, string> };
};

export type LinkPublicCookbook = Omit<PublicCookbook, "recipes"> & {
  recipes: LinkRecipe[];
};

export type LinkCookbookRecipe = {
  cookbook: LinkPublicCookbook;
  recipe: LinkRecipe;
};

export const getCookbook = createServerFn({ method: "GET" })
  .validator((input: CookbookInput) => input)
  .handler(async ({ data }): Promise<LinkPublicCookbook | null> => {
    const path = `/api/cookbooks/${encodeURIComponent(data.slug)}`;
    const response = await fetchApiPath(path).catch(() => null);
    if (!response?.ok) {
      return null;
    }
    return (await response.json()) as LinkPublicCookbook;
  });

export const getCookbookRecipe = createServerFn({ method: "GET" })
  .validator((input: CookbookRecipeInput) => input)
  .handler(async ({ data }): Promise<LinkCookbookRecipe | null> => {
    const path = `/api/cookbooks/${encodeURIComponent(
      data.slug,
    )}/recipes/${encodeURIComponent(data.recipeId)}`;
    const response = await fetchApiPath(path).catch(() => null);
    if (!response?.ok) {
      return null;
    }
    return (await response.json()) as LinkCookbookRecipe;
  });
