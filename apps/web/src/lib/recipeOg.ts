import type { SharedRecipe } from "@open-cook/core";

const siteName = "OpenCook";
const siteOrigin = "https://open-cook.com";
const defaultOgImage = `${siteOrigin}/icon-512.png`;

type MetaTag = Record<string, string>;
type HeadResult = { meta: MetaTag[]; links: MetaTag[] };

function recipeImage(recipe: SharedRecipe): string {
  return recipe.images?.[0]?.url ?? recipe.imageUrl ?? defaultOgImage;
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

// Builds the per-route <head> for a recipe share link so social crawlers (which
// don't run JS) get full Open Graph + Twitter card previews from the SSR HTML.
export function buildRecipeHead(
  recipe: SharedRecipe | null,
  params: { ownerId: string; id: string },
): HeadResult {
  if (!recipe) {
    return { meta: [{ title: `Recipe not found · ${siteName}` }], links: [] };
  }

  const title = `${recipe.title} · ${siteName}`;
  const description = recipeDescription(recipe);
  const image = recipeImage(recipe);
  const canonical = `${siteOrigin}/r/${params.ownerId}/${params.id}`;

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: siteName },
      { property: "og:title", content: recipe.title },
      { property: "og:description", content: description },
      { property: "og:image", content: image },
      { property: "og:url", content: canonical },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: recipe.title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}
