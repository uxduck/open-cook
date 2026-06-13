import type { PublicCookbook, PublicGathering, SharedRecipe } from "@open-cook/core";

export const siteName = "OpenCook";
export const siteOrigin = "https://open-cook.com";
const defaultOgImage = `${siteOrigin}/icon-512.png`;

type MetaTag = Record<string, string>;
type HeadResult = { meta: MetaTag[]; links: MetaTag[] };

function pathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function publicRecipePath(ownerId: string, recipeId: string): string {
  return `/r/${pathSegment(ownerId)}/${pathSegment(recipeId)}`;
}

export function publicRecipeUrl(ownerId: string, recipeId: string): string {
  return `${siteOrigin}${publicRecipePath(ownerId, recipeId)}`;
}

function cookbookPath(slug: string): string {
  return `/c/${pathSegment(slug)}`;
}

function cookbookRecipePath(slug: string, recipeId: string): string {
  return `${cookbookPath(slug)}/r/${pathSegment(recipeId)}`;
}

function gatheringPath(slug: string): string {
  return `/g/${pathSegment(slug)}`;
}

function gatheringRecipePath(slug: string, recipeId: string): string {
  return `${gatheringPath(slug)}/r/${pathSegment(recipeId)}`;
}

function recipeImage(recipe: SharedRecipe): string {
  return recipe.images?.[0]?.url ?? recipe.imageUrl ?? defaultOgImage;
}

function optionalRecipeImage(recipe?: SharedRecipe): string {
  return recipe ? recipeImage(recipe) : defaultOgImage;
}

function recipeImages(recipe: SharedRecipe): string[] {
  const urls = [
    ...(recipe.images?.map((image) => image.url) ?? []),
    recipe.imageUrl,
  ].filter((url): url is string => Boolean(url));
  return urls.length ? [...new Set(urls)] : [defaultOgImage];
}

// A human description for the share card: the recipe's own description when set,
// otherwise a synthesized "time · servings · tags" summary attributed to the owner.
function recipeDescription(recipe: SharedRecipe): string {
  const own = recipe.description?.trim();
  if (own) {
    return own;
  }
  const total =
    (recipe.totalTimeMinutes ?? 0) ||
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  const bits: string[] = [];
  if (total > 0) {
    bits.push(`${total} min`);
  }
  if (recipe.servings?.trim()) {
    bits.push(recipe.servings.trim());
  }
  if (recipe.tags.length) {
    bits.push(recipe.tags.slice(0, 3).join(", "));
  }
  const summary = bits.join(" · ");
  const by = `Shared by ${recipe.owner.name} on ${siteName}.`;
  return summary ? `${summary}. ${by}` : `A recipe on ${siteName}. ${by}`;
}

function robotsNoIndex(): MetaTag {
  return { name: "robots", content: "noindex, follow" };
}

function notFoundHead(title: string): HeadResult {
  return {
    meta: [{ title }, robotsNoIndex()],
    links: [],
  };
}

function headResult(input: {
  canonical: string;
  description: string;
  image?: string;
  noindex?: boolean;
  title: string;
  type: "article" | "website";
}): HeadResult {
  return {
    meta: [
      { title: input.title },
      { name: "description", content: input.description },
      ...(input.noindex ? [robotsNoIndex()] : []),
      { property: "og:type", content: input.type },
      { property: "og:site_name", content: siteName },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:url", content: input.canonical },
      { property: "og:image", content: input.image ?? defaultOgImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: input.title },
      { name: "twitter:description", content: input.description },
      { name: "twitter:image", content: input.image ?? defaultOgImage },
    ],
    links: [{ rel: "canonical", href: input.canonical }],
  };
}

// Builds the per-route <head> for a recipe share link so social crawlers (which
// don't run JS) get full Open Graph + Twitter card previews from the SSR HTML.
export function buildRecipeHead(
  recipe: SharedRecipe | null,
  params: { ownerId: string; id: string },
): HeadResult {
  if (!recipe) {
    return notFoundHead(`Recipe not found · ${siteName}`);
  }

  const title = `${recipe.title} · ${siteName}`;
  const description = recipeDescription(recipe);
  const canonical = publicRecipeUrl(params.ownerId, params.id);

  return headResult({
    canonical,
    description,
    image: recipeImage(recipe),
    noindex: recipe.visibility === "unlisted",
    title,
    type: "article",
  });
}

export function buildCookbookHead(
  cookbook: PublicCookbook | null,
  params: { slug: string },
): HeadResult {
  if (!cookbook) {
    return notFoundHead(`Cookbook not found · ${siteName}`);
  }

  const title = `${cookbook.title} · ${siteName}`;
  const description =
    cookbook.description ?? `${cookbook.owner.name}'s OpenCook recipes.`;
  return headResult({
    canonical: `${siteOrigin}${cookbookPath(params.slug)}`,
    description,
    image: optionalRecipeImage(cookbook.recipes[0]),
    noindex: cookbook.visibility === "unlisted",
    title,
    type: "website",
  });
}

export function buildCookbookRecipeHead(
  result: { cookbook: PublicCookbook; recipe: SharedRecipe } | null,
  params: { recipeId: string; slug: string },
): HeadResult {
  if (!result) {
    return notFoundHead(`Cookbook recipe not found · ${siteName}`);
  }

  const title = `${result.recipe.title} · ${result.cookbook.title}`;
  const description =
    result.recipe.description ?? `A recipe from ${result.cookbook.title}.`;
  return headResult({
    canonical: `${siteOrigin}${cookbookRecipePath(params.slug, params.recipeId)}`,
    description,
    image: recipeImage(result.recipe),
    noindex: result.cookbook.visibility === "unlisted",
    title,
    type: "article",
  });
}

export function buildGatheringHead(
  gathering: PublicGathering | null,
  params: { slug: string },
): HeadResult {
  if (!gathering) {
    return notFoundHead(`Gathering not found · ${siteName}`);
  }

  const title = `${gathering.title} · ${siteName}`;
  const recipeNames = gathering.recipes.map((recipe) => recipe.title).join(", ");
  const description = recipeNames
    ? `${gathering.welcome} Menu: ${recipeNames}.`
    : gathering.welcome;
  const artwork = gathering.artifacts.find(
    (artifact) => artifact.status === "ready" && artifact.mediaUrl,
  )?.mediaUrl;
  return headResult({
    canonical: `${siteOrigin}${gatheringPath(params.slug)}`,
    description,
    image: artwork ?? optionalRecipeImage(gathering.recipes[0]),
    noindex: true,
    title,
    type: "website",
  });
}

export function buildGatheringRecipeHead(
  gathering: PublicGathering | null,
  recipe: SharedRecipe | undefined,
  params: { slug: string; recipeId: string },
): HeadResult {
  if (!gathering || !recipe) {
    return notFoundHead(`Gathering recipe not found · ${siteName}`);
  }

  const title = `${recipe.title} · ${gathering.title}`;
  const description = recipe.description ?? `A recipe from ${gathering.title}.`;
  return headResult({
    canonical: `${siteOrigin}${gatheringRecipePath(params.slug, params.recipeId)}`,
    description,
    image: recipeImage(recipe),
    noindex: true,
    title,
    type: "article",
  });
}

function isoDuration(minutes?: number): string | undefined {
  if (!minutes || minutes <= 0) {
    return undefined;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `PT${hours ? `${hours}H` : ""}${mins ? `${mins}M` : ""}`;
}

export function buildRecipeJsonLd(
  recipe: SharedRecipe,
  canonical: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipeDescription(recipe),
    image: recipeImages(recipe),
    author: {
      "@type": "Person",
      name: recipe.owner.name,
    },
    datePublished: recipe.createdAt,
    dateModified: recipe.updatedAt,
    prepTime: isoDuration(recipe.prepTimeMinutes),
    cookTime: isoDuration(recipe.cookTimeMinutes),
    totalTime: isoDuration(recipe.totalTimeMinutes),
    recipeYield: recipe.servings,
    keywords: recipe.tags.length ? recipe.tags.join(", ") : undefined,
    recipeIngredient: recipe.ingredients.map((ingredient) => ingredient.text),
    recipeInstructions: recipe.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      text: step.text,
    })),
    url: canonical,
  };
}
