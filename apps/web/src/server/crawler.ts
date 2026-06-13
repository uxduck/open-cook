import type { SharedRecipe } from "@open-cook/core";
import { publicRecipeUrl, siteOrigin } from "../lib/recipeOg";

type SitemapEntry = {
  lastmod?: string;
  loc: string;
};

const staticSitemapEntries: SitemapEntry[] = [
  { loc: siteOrigin },
  { loc: `${siteOrigin}/pricing` },
];

export function buildRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /account",
    "Disallow: /app",
    "Disallow: /login",
    "Disallow: /onboarding",
    "Disallow: /register",
    `Sitemap: ${siteOrigin}/sitemap.xml`,
    "",
  ].join("\n");
}

export function robotsTxtResponse() {
  return new Response(buildRobotsTxt(), {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export async function sitemapXmlResponse() {
  const entries = [...staticSitemapEntries, ...(await publicRecipeSitemapEntries())];
  return new Response(buildSitemapXml(entries), {
    headers: {
      "cache-control": "public, max-age=900",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}

export function buildSitemapXml(entries: SitemapEntry[]) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) =>
      [
        "  <url>",
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "</urlset>",
    "",
  ].join("\n");
}

async function publicRecipeSitemapEntries(): Promise<SitemapEntry[]> {
  const { fetchApiPath } = await import("./apiProxy");
  const response = await fetchApiPath("/api/recipes/public").catch(() => null);
  if (!response?.ok) {
    return [];
  }

  const recipes = ((await response.json().catch(() => [])) ?? []) as SharedRecipe[];
  return recipes
    .filter((recipe) => recipe.visibility === "public")
    .map((recipe) => ({
      lastmod: recipe.updatedAt,
      loc: publicRecipeUrl(recipe.owner.id, recipe.id),
    }));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
