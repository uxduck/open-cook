import type { Recipe } from "@open-cook/core";

const defaultCacheControl = "public, max-age=31536000, immutable";
const maxImageBytes = 12 * 1024 * 1024;
const imageFetchTimeoutMs = 8_000;

export type ImageAsset = {
  key: string;
  url: string;
  sourceUrl: string;
  contentType: string;
  size: number;
};

export type StoreImageOptions = {
  recipeId?: string;
  filename?: string;
};

export type ImageAssetStore = {
  canStore: boolean;
  isManagedUrl(url: string): boolean;
  publicUrlForKey(key: string): string;
  readImage(key: string): Promise<R2ObjectBody | null>;
  storeImageFromUrl(
    sourceUrl: string,
    options?: StoreImageOptions,
  ): Promise<ImageAsset>;
};

export function createImageAssetStore({
  bucket,
  origin,
  publicBaseUrl,
}: {
  bucket?: R2Bucket;
  origin: string;
  publicBaseUrl?: string;
}): ImageAssetStore {
  const publicBase = normalizeBaseUrl(publicBaseUrl) ?? `${origin}/api/assets/images`;

  return {
    canStore: Boolean(bucket),
    isManagedUrl(url: string) {
      return normalizeComparableUrl(url).startsWith(`${publicBase}/`);
    },
    publicUrlForKey(key: string) {
      return `${publicBase}/${encodeURIComponent(key)}`;
    },
    async readImage(key: string) {
      return bucket ? bucket.get(key) : null;
    },
    async storeImageFromUrl(sourceUrl: string, options: StoreImageOptions = {}) {
      if (!bucket) {
        throw new Error("Recipe image R2 bucket is not configured.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), imageFetchTimeoutMs);

      const response = await fetch(sourceUrl, {
        headers: {
          Accept: "image/*,*/*;q=0.8",
          "User-Agent": "OpenCook/0.1 recipe image portability tool",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`Could not fetch image: ${response.status}`);
      }

      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > maxImageBytes) {
        throw new Error("Image is larger than the OpenCook demo limit.");
      }

      const contentType =
        response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ??
        inferContentType(sourceUrl);

      if (!contentType?.startsWith("image/")) {
        throw new Error("The fetched URL did not return an image.");
      }

      const hash = await shortHash(bytes);
      const extension =
        extensionFromContentType(contentType) ?? extensionFromUrl(sourceUrl) ?? "img";
      const key = `${safeSegment(
        options.recipeId ?? options.filename ?? "recipe-image",
      )}-${hash}.${extension}`;

      await bucket.put(key, bytes, {
        customMetadata: {
          sourceUrl,
        },
        httpMetadata: {
          cacheControl: defaultCacheControl,
          contentType,
        },
      });

      return {
        key,
        url: `${publicBase}/${encodeURIComponent(key)}`,
        sourceUrl,
        contentType,
        size: bytes.byteLength,
      };
    },
  };
}

export async function mirrorRecipeInputImage<
  T extends { imageUrl?: string; title?: string },
>(input: T, assets: ImageAssetStore, options: StoreImageOptions = {}): Promise<T> {
  if (!input.imageUrl || !assets.canStore || assets.isManagedUrl(input.imageUrl)) {
    return input;
  }

  try {
    const asset = await assets.storeImageFromUrl(input.imageUrl, {
      filename: input.title,
      ...options,
    });
    return { ...input, imageUrl: asset.url };
  } catch {
    return input;
  }
}

export async function mirrorRecipeImages(
  recipes: Recipe[],
  assets: ImageAssetStore,
): Promise<Recipe[]> {
  return Promise.all(
    recipes.map(async (recipe) => {
      const mirrored = await mirrorRecipeInputImage(recipe, assets, {
        recipeId: recipe.id,
        filename: recipe.title,
      });
      return {
        ...recipe,
        imageUrl: mirrored.imageUrl,
      };
    }),
  );
}

function normalizeBaseUrl(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return normalizeComparableUrl(url.toString());
  } catch {
    return undefined;
  }
}

function normalizeComparableUrl(value: string) {
  return value.replace(/\/+$/, "");
}

async function shortHash(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "recipe-image"
  );
}

function extensionFromContentType(contentType: string) {
  switch (contentType) {
    case "image/avif":
      return "avif";
    case "image/gif":
      return "gif";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return undefined;
  }
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    return match?.[1]?.toLowerCase();
  } catch {
    return undefined;
  }
}

function inferContentType(url: string) {
  const extension = extensionFromUrl(url);
  if (!extension) {
    return undefined;
  }
  return (
    {
      avif: "image/avif",
      gif: "image/gif",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      svg: "image/svg+xml",
      webp: "image/webp",
    } satisfies Record<string, string>
  )[extension];
}
