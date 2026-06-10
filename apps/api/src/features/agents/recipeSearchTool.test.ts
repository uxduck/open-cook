import type { Recipe } from "@open-cook/core";
import { describe, expect, it } from "vitest";
import { searchRecipeSummaries } from "./recipeSearchTool";

describe("searchRecipeSummaries", () => {
  it("returns compact ranked matches", () => {
    const result = searchRecipeSummaries(
      [
        recipe({
          id: "ingredient-match",
          title: "Weeknight Noodles",
          ingredients: [{ text: "2 tbsp white miso" }],
        }),
        recipe({
          id: "title-match",
          title: "Miso Aubergine",
          ingredients: [{ text: "1 aubergine" }],
        }),
        recipe({
          id: "no-match",
          title: "Lemon Pasta",
          ingredients: [{ text: "1 lemon" }],
        }),
      ],
      { q: "miso", limit: 2 },
    );

    expect(result).toMatchObject({
      query: { q: "miso", limit: 2 },
      count: 2,
      returned: 2,
    });
    expect(result.recipes.map((item) => item.id)).toEqual([
      "title-match",
      "ingredient-match",
    ]);
    expect(result.recipes[0]?.matchedFields).toContain("title");
    expect(result.recipes[1]?.ingredientMatches).toEqual(["2 tbsp white miso"]);
    expect(result.recipes[0]).not.toHaveProperty("ingredients");
  });

  it("can include bounded ingredient and step previews", () => {
    const result = searchRecipeSummaries(
      [
        recipe({
          title: "Aubergine Miso",
          ingredients: Array.from({ length: 8 }, (_, index) => ({
            text: `ingredient ${index + 1}`,
          })),
          steps: Array.from({ length: 8 }, (_, index) => ({
            text: `step ${index + 1}`,
          })),
        }),
      ],
      { includeIngredients: true, includeSteps: true },
    );

    expect(result.recipes[0]?.ingredients).toHaveLength(6);
    expect(result.recipes[0]?.steps).toHaveLength(6);
  });

  it("returns an empty set when a text query has no matches", () => {
    const result = searchRecipeSummaries(
      [recipe({ title: "Lemon Pasta", ingredients: [{ text: "1 lemon" }] })],
      { q: "miso" },
    );

    expect(result).toMatchObject({ count: 0, returned: 0, recipes: [] });
  });
});

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: "recipe-id",
    title: "Recipe",
    tags: [],
    ingredients: [],
    steps: [],
    notes: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
