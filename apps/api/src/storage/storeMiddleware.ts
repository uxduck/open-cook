import type { MiddlewareHandler } from "hono";
import type { Env } from "../AppContext";
import { createImageAssetStore } from "../assets/imageAssets";
import { createD1RecipeStore } from "./d1RecipeStore";
import { createMemoryRecipeStore } from "./memoryRecipeStore";
import type { RecipeStore } from "./types";

const memoryStore = createMemoryRecipeStore();
const unauthenticatedStore = createUnauthenticatedRecipeStore();

export const storeMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const origin = new URL(c.req.url).origin;
  c.set(
    "assets",
    createImageAssetStore({
      bucket: c.env.RECIPE_IMAGES,
      origin,
      publicBaseUrl: c.env.ASSETS_PUBLIC_BASE_URL,
      cloudflareImages: {
        accountId: c.env.CF_ACCOUNT_ID,
        apiToken: c.env.CF_IMAGES_TOKEN,
        accountHash: c.env.CF_IMAGES_ACCOUNT_HASH,
        variant: c.env.CF_IMAGES_VARIANT,
      },
    }),
  );
  c.set(
    "store",
    c.env.DB
      ? c.var.user
        ? createD1RecipeStore(c.env.DB, c.var.user.id)
        : unauthenticatedStore
      : memoryStore,
  );
  await next();
};

function createUnauthenticatedRecipeStore(): RecipeStore {
  const fail = async (): Promise<never> => {
    throw new Error("A user session is required before accessing recipes.");
  };

  return {
    list: fail,
    count: fail,
    get: fail,
    create: fail,
    update: fail,
    delete: fail,
    upsertMany: fail,
    replaceAll: fail,
    listSharedWithMe: fail,
    listPublic: fail,
    copyFrom: fail,
    markShareSeen: fail,
    dismissShare: fail,
    listShares: fail,
    share: fail,
    unshare: fail,
    getCookProgress: fail,
    updateCookProgress: fail,
    resetCookProgress: fail,
  };
}
