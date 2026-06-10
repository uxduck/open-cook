import { recipeSchema } from "@open-cook/core";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import { mirrorRecipeImages } from "../../assets/imageAssets";
import { requireAuthMiddleware } from "../auth/requireAuth";

const imageAssetSchema = v.object({
  key: v.string(),
  url: v.string(),
  sourceUrl: v.string(),
  contentType: v.string(),
  size: v.number(),
});

const imageFromUrlSchema = v.object({
  url: v.pipe(v.string(), v.url()),
  recipeId: v.optional(v.string()),
  filename: v.optional(v.string()),
});

const imageKeyParamSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
});

const mirrorRecipesResultSchema = v.object({
  failed: v.number(),
  updated: v.number(),
  skipped: v.number(),
  recipes: v.array(recipeSchema),
});

export const assetsApp = new Hono<Env>()
  .post(
    "/images/from-url",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Copy a public recipe image URL into the configured public R2 bucket.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(imageAssetSchema) },
          },
          description: "Image copied into R2.",
        },
        503: { description: "R2 image storage is not configured." },
      },
    }),
    validator("json", imageFromUrlSchema),
    async (c) => {
      if (!c.var.assets.canStore) {
        return c.json({ error: "R2 image storage is not configured." }, 503);
      }

      try {
        const asset = await c.var.assets.storeImageFromUrl(c.req.valid("json").url, {
          filename: c.req.valid("json").filename,
          recipeId: c.req.valid("json").recipeId,
        });
        return c.json(asset, 201);
      } catch (error) {
        return c.json(
          { error: error instanceof Error ? error.message : "Image import failed" },
          422,
        );
      }
    },
  )
  .post(
    "/images/upload",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Upload an image file. Stored (and compressed) via the configured image backend.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(imageAssetSchema) },
          },
          description: "Image uploaded.",
        },
        400: { description: "No image file was provided." },
        503: { description: "Image storage is not configured." },
      },
    }),
    async (c) => {
      if (!c.var.assets.canStore) {
        return c.json({ error: "Image storage is not configured." }, 503);
      }

      const form = await c.req.formData().catch(() => undefined);
      const file = form?.get("file");
      if (!(file instanceof File)) {
        return c.json({ error: "Expected a multipart form field named 'file'." }, 400);
      }

      const contentType = file.type?.trim() || "application/octet-stream";
      if (!contentType.startsWith("image/")) {
        return c.json({ error: "Uploaded file is not an image." }, 400);
      }

      const recipeId = form?.get("recipeId");
      try {
        const asset = await c.var.assets.storeImageBytes(await file.arrayBuffer(), {
          contentType,
          filename: file.name,
          recipeId: typeof recipeId === "string" ? recipeId : undefined,
          sourceUrl: "upload",
        });
        return c.json(asset, 201);
      } catch (error) {
        return c.json(
          { error: error instanceof Error ? error.message : "Image upload failed" },
          422,
        );
      }
    },
  )
  .post(
    "/images/mirror-recipes",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Copy all recipe image URLs into public R2 and update recipes to point at the owned copies.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(mirrorRecipesResultSchema) },
          },
          description: "Recipe images mirrored.",
        },
        503: { description: "R2 image storage is not configured." },
      },
    }),
    async (c) => {
      if (!c.var.assets.canStore) {
        return c.json({ error: "R2 image storage is not configured." }, 503);
      }

      const recipes = await c.var.store.list();
      const mirroredRecipes = await mirrorRecipeImages(recipes, c.var.assets);
      const updatedRecipes = mirroredRecipes.filter((recipe, index) => {
        const original = recipes[index];
        return (
          recipe.imageUrl !== original?.imageUrl ||
          JSON.stringify(recipe.images) !== JSON.stringify(original?.images)
        );
      });
      const failed = mirroredRecipes.filter((recipe, index) => {
        const original = recipes[index];
        return (
          original?.imageUrl &&
          recipe.imageUrl === original.imageUrl &&
          !c.var.assets.isManagedUrl(recipe.imageUrl)
        );
      }).length;

      for (const recipe of updatedRecipes) {
        await c.var.store.update(recipe.id, {
          imageUrl: recipe.imageUrl,
          images: recipe.images,
        });
      }

      return c.json({
        failed,
        updated: updatedRecipes.length,
        skipped: recipes.length - updatedRecipes.length - failed,
        recipes: mirroredRecipes,
      });
    },
  )
  .get(
    "/images/:key",
    describeRoute({
      description:
        "Public, unsigned image read-through for local development or Worker-hosted asset URLs.",
      responses: {
        200: { description: "Public recipe image." },
        404: { description: "Image not found." },
      },
    }),
    validator("param", imageKeyParamSchema),
    async (c) => {
      const object = await c.var.assets.readImage(c.req.valid("param").key);
      if (!object) {
        return c.json({ error: "Image not found" }, 404);
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set(
        "cache-control",
        headers.get("cache-control") ?? "public, max-age=86400",
      );
      headers.set("etag", object.httpEtag);
      return new Response(object.body, { headers });
    },
  );
