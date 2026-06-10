import type { Recipe, RecipeImage } from "@open-cook/core";
import { appVersion } from "../AppMetadata";

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

export type StoreImageBytesOptions = StoreImageOptions & {
  contentType: string;
  sourceUrl?: string;
};

export type ImageAssetStore = {
  adapter: string;
  canStore: boolean;
  isManagedUrl(url: string): boolean;
  publicUrlForKey(key: string): string;
  readImage(key: string): Promise<R2ObjectBody | null>;
  storeImageBytes(
    bytes: ArrayBuffer | Uint8Array,
    options: StoreImageBytesOptions,
  ): Promise<ImageAsset>;
  storeImageFromUrl(
    sourceUrl: string,
    options?: StoreImageOptions,
  ): Promise<ImageAsset>;
};

export type CloudflareImagesConfig = {
  accountId?: string;
  apiToken?: string;
  accountHash?: string;
  variant?: string;
};

/**
 * Picks the best available image backend. Cloudflare Images (managed storage +
 * delivery with automatic WebP/AVIF compression) is used when fully configured;
 * otherwise we fall back to the raw R2 bucket so local development keeps working.
 */
export function createImageAssetStore({
  bucket,
  origin,
  publicBaseUrl,
  cloudflareImages,
}: {
  bucket?: R2Bucket;
  origin: string;
  publicBaseUrl?: string;
  cloudflareImages?: CloudflareImagesConfig;
}): ImageAssetStore {
  if (
    cloudflareImages?.accountId &&
    cloudflareImages.apiToken &&
    cloudflareImages.accountHash
  ) {
    return createCloudflareImagesStore({
      accountId: cloudflareImages.accountId,
      apiToken: cloudflareImages.apiToken,
      accountHash: cloudflareImages.accountHash,
      variant: cloudflareImages.variant,
    });
  }

  return createR2ImageAssetStore({ bucket, origin, publicBaseUrl });
}

function createR2ImageAssetStore({
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
    adapter: "cloudflare-r2",
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
    async storeImageBytes(
      bytes: ArrayBuffer | Uint8Array,
      options: StoreImageBytesOptions,
    ) {
      if (!bucket) {
        throw new Error("Recipe image R2 bucket is not configured.");
      }

      const imageBytes = bytesToArrayBuffer(bytes);
      if (imageBytes.byteLength > maxImageBytes) {
        throw new Error("Image is larger than the OpenCook demo limit.");
      }

      const contentType = options.contentType.split(";")[0]?.trim().toLowerCase();
      if (!contentType?.startsWith("image/")) {
        throw new Error("Generated output did not return an image.");
      }

      const sourceUrl = options.sourceUrl ?? "generated";
      const hash = await shortHash(imageBytes);
      const extension = extensionFromContentType(contentType) ?? "img";
      const key = `${safeSegment(
        options.recipeId ?? options.filename ?? "recipe-image",
      )}-${hash}.${extension}`;

      await bucket.put(key, imageBytes, {
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
        size: imageBytes.byteLength,
      };
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
          "User-Agent": `OpenCook/${appVersion} recipe image portability tool`,
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

const cloudflareImagesMaxBytes = 10 * 1024 * 1024;

type CloudflareImagesResult = {
  id: string;
  filename?: string;
  variants?: string[];
};

function createCloudflareImagesStore(
  config: Required<Pick<CloudflareImagesConfig, "accountId" | "apiToken" | "accountHash">> &
    Pick<CloudflareImagesConfig, "variant">,
): ImageAssetStore {
  const variant = config.variant?.trim() || "public";
  const deliveryBase = `https://imagedelivery.net/${config.accountHash}`;
  const uploadEndpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1`;

  function urlForId(id: string) {
    return `${deliveryBase}/${encodeURIComponent(id)}/${variant}`;
  }

  function pickDeliveryUrl(result: CloudflareImagesResult) {
    const match = result.variants?.find((url) => url.endsWith(`/${variant}`));
    return match ?? urlForId(result.id);
  }

  async function upload(form: FormData): Promise<CloudflareImagesResult> {
    const response = await fetch(uploadEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiToken}` },
      body: form,
    });

    const data = (await response.json().catch(() => undefined)) as
      | { success?: boolean; result?: CloudflareImagesResult; errors?: unknown[] }
      | undefined;

    if (!response.ok || !data?.success || !data.result?.id) {
      const detail =
        Array.isArray(data?.errors) && data.errors.length
          ? JSON.stringify(data.errors)
          : `${response.status}`;
      throw new Error(`Cloudflare Images upload failed: ${detail}`);
    }

    return data.result;
  }

  return {
    adapter: "cloudflare-images",
    canStore: true,
    isManagedUrl(url: string) {
      return normalizeComparableUrl(url).startsWith(`${deliveryBase}/`);
    },
    publicUrlForKey(key: string) {
      return urlForId(key);
    },
    // Cloudflare Images serves bytes directly from imagedelivery.net.
    async readImage() {
      return null;
    },
    async storeImageBytes(
      bytes: ArrayBuffer | Uint8Array,
      options: StoreImageBytesOptions,
    ) {
      const imageBytes = bytesToArrayBuffer(bytes);
      if (imageBytes.byteLength > cloudflareImagesMaxBytes) {
        throw new Error("Image is larger than the 10MB Cloudflare Images limit.");
      }

      const contentType = options.contentType.split(";")[0]?.trim().toLowerCase();
      if (!contentType?.startsWith("image/")) {
        throw new Error("Generated output did not return an image.");
      }

      const extension = extensionFromContentType(contentType) ?? "img";
      const filename = `${safeSegment(
        options.recipeId ?? options.filename ?? "recipe-image",
      )}.${extension}`;

      const form = new FormData();
      form.append("file", new Blob([imageBytes], { type: contentType }), filename);
      const result = await upload(form);

      return {
        key: result.id,
        url: pickDeliveryUrl(result),
        sourceUrl: options.sourceUrl ?? "generated",
        contentType,
        size: imageBytes.byteLength,
      };
    },
    async storeImageFromUrl(sourceUrl: string, _options: StoreImageOptions = {}) {
      const form = new FormData();
      form.append("url", sourceUrl);
      const result = await upload(form);

      return {
        key: result.id,
        url: pickDeliveryUrl(result),
        sourceUrl,
        contentType: inferContentType(sourceUrl) ?? "image/jpeg",
        size: 0,
      };
    },
  };
}

function bytesToArrayBuffer(bytes: ArrayBuffer | Uint8Array) {
  if (bytes instanceof ArrayBuffer) {
    return bytes;
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function mirrorExternalUrl(
  url: string,
  assets: ImageAssetStore,
  options: StoreImageOptions,
): Promise<string> {
  if (!assets.canStore || assets.isManagedUrl(url)) {
    return url;
  }
  try {
    const asset = await assets.storeImageFromUrl(url, options);
    return asset.url;
  } catch {
    return url;
  }
}

export async function mirrorRecipeInputImage<
  T extends { imageUrl?: string; images?: RecipeImage[]; title?: string },
>(input: T, assets: ImageAssetStore, options: StoreImageOptions = {}): Promise<T> {
  if (!assets.canStore) {
    return input;
  }

  const filenameOptions = { filename: input.title, ...options };

  const images = input.images?.length
    ? await Promise.all(
        input.images.map(async (image) => ({
          ...image,
          url: await mirrorExternalUrl(image.url, assets, filenameOptions),
        })),
      )
    : input.images;

  // Keep the legacy cover in sync: prefer the (mirrored) gallery cover, else
  // mirror the standalone imageUrl for imports that only set the single field.
  const imageUrl = images?.length
    ? images[0]?.url
    : input.imageUrl
      ? await mirrorExternalUrl(input.imageUrl, assets, filenameOptions)
      : input.imageUrl;

  if (images === input.images && imageUrl === input.imageUrl) {
    return input;
  }

  return { ...input, images, imageUrl };
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
        images: mirrored.images,
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
