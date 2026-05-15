import type { MiddlewareHandler } from "hono";
import type { Env } from "../AppContext";
import { createImageAssetStore } from "../assets/imageAssets";
import { createD1RecipeStore } from "./d1RecipeStore";
import { createMemoryRecipeStore } from "./memoryRecipeStore";

const memoryStore = createMemoryRecipeStore();

export const storeMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const origin = new URL(c.req.url).origin;
  c.set(
    "assets",
    createImageAssetStore({
      bucket: c.env.RECIPE_IMAGES,
      origin,
      publicBaseUrl: c.env.ASSETS_PUBLIC_BASE_URL,
    }),
  );
  c.set("store", c.env.DB ? createD1RecipeStore(c.env.DB) : memoryStore);
  await next();
};
