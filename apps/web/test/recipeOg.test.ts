import type { SharedRecipe } from "@open-cook/core";
import { describe, expect, it } from "vitest";
import { buildRecipeHead, buildRecipeJsonLd } from "../src/lib/recipeOg";

const baseRecipe: SharedRecipe = {
  id: "r1",
  title: "Granny apple cake",
  description: "Family classic",
  tags: ["baking"],
  ingredients: [{ text: "4 apples" }],
  steps: [{ text: "Bake it." }],
  notes: [],
  visibility: "public",
  createdAt: "2026-06-10T08:00:00.000Z",
  updatedAt: "2026-06-10T08:00:00.000Z",
  owner: { id: "u1", name: "Alice Tester" },
};

function meta(head: ReturnType<typeof buildRecipeHead>, key: string) {
  return head.meta.find((tag) => tag.property === key || tag.name === key)?.content;
}

describe("buildRecipeHead", () => {
  it("emits Open Graph + Twitter tags from the recipe", () => {
    const head = buildRecipeHead(baseRecipe, { ownerId: "u1", id: "r1" });
    expect(head.meta.find((tag) => tag.title)?.title).toBe(
      "Granny apple cake · OpenCook",
    );
    expect(meta(head, "og:title")).toBe("Granny apple cake · OpenCook");
    expect(meta(head, "og:description")).toBe("Family classic");
    expect(meta(head, "og:type")).toBe("article");
    expect(meta(head, "twitter:card")).toBe("summary_large_image");
    expect(meta(head, "og:url")).toBe("https://open-cook.com/r/u1/r1");
    // No image on the recipe → falls back to the site default.
    expect(meta(head, "og:image")).toContain("icon-512.png");
  });

  it("does not mark public recipes noindex", () => {
    const head = buildRecipeHead(baseRecipe, { ownerId: "u1", id: "r1" });
    expect(meta(head, "robots")).toBeUndefined();
  });

  it("marks unlisted recipes noindex", () => {
    const head = buildRecipeHead(
      { ...baseRecipe, visibility: "unlisted" },
      { ownerId: "u1", id: "r1" },
    );
    expect(meta(head, "robots")).toBe("noindex, follow");
  });

  it("prefers the recipe's own image when present", () => {
    const head = buildRecipeHead(
      { ...baseRecipe, imageUrl: "https://img.example/cake.jpg" },
      { ownerId: "u1", id: "r1" },
    );
    expect(meta(head, "og:image")).toBe("https://img.example/cake.jpg");
  });

  it("synthesizes a description when the recipe has none", () => {
    const head = buildRecipeHead(
      { ...baseRecipe, description: undefined, totalTimeMinutes: 40, servings: "8" },
      { ownerId: "u1", id: "r1" },
    );
    expect(meta(head, "og:description")).toContain("40 min");
    expect(meta(head, "og:description")).toContain("Shared by Alice Tester");
  });

  it("falls back to a not-found title when the recipe is missing", () => {
    const head = buildRecipeHead(null, { ownerId: "u1", id: "r1" });
    expect(head.meta[0]?.title).toBe("Recipe not found · OpenCook");
    expect(meta(head, "robots")).toBe("noindex, follow");
  });

  it("builds schema.org Recipe JSON-LD", () => {
    const jsonLd = buildRecipeJsonLd(
      {
        ...baseRecipe,
        cookTimeMinutes: 45,
        prepTimeMinutes: 15,
        servings: "8 slices",
        totalTimeMinutes: 60,
      },
      "https://open-cook.com/r/u1/r1",
    );
    expect(jsonLd["@type"]).toBe("Recipe");
    expect(jsonLd.name).toBe("Granny apple cake");
    expect(jsonLd.recipeIngredient).toEqual(["4 apples"]);
    expect(jsonLd.recipeInstructions).toEqual([
      { "@type": "HowToStep", position: 1, text: "Bake it." },
    ]);
    expect(jsonLd.prepTime).toBe("PT15M");
    expect(jsonLd.cookTime).toBe("PT45M");
    expect(jsonLd.totalTime).toBe("PT1H");
    expect(jsonLd.url).toBe("https://open-cook.com/r/u1/r1");
  });
});
