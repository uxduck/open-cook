import { structureRecipe } from "@open-cook/core";
import { describe, expect, it, vi } from "vitest";
import { structureRecipeWithAi } from "./recipeStructuring";

const baseRecipe = {
  id: "recipe-1",
  title: "Tomato Pasta",
  servings: "4 bowls",
  tags: [],
  ingredients: [
    { text: "200 g spaghetti" },
    { text: "2 tomatoes, diced" },
    { text: "Salt to taste" },
  ],
  steps: [
    { text: "Boil spaghetti for 10 minutes." },
    { text: "Toss tomatoes through the pasta." },
  ],
  notes: [],
  createdAt: "2026-06-10T08:00:00.000Z",
  updatedAt: "2026-06-10T08:00:00.000Z",
};

describe("recipe structuring", () => {
  it("parses quantities and non-scaling ingredient lines deterministically", () => {
    const recipe = structureRecipe(baseRecipe);

    expect(recipe.ingredients[0]).toMatchObject({
      quantity: { value: 200, valueText: "200", unit: "g" },
      item: "spaghetti",
      scalable: true,
    });
    expect(recipe.ingredients[2]).toMatchObject({
      item: "Salt to taste",
      scalable: false,
    });
    expect(recipe.steps[0]?.timers?.[0]).toMatchObject({ minutes: 10 });
    expect(recipe.steps[0]?.ingredientIds).toContain("ingredient-1");
  });

  it("merges Workers AI structure without replacing source text", async () => {
    const ai = {
      run: vi.fn(async () => ({
        response: {
          ingredients: [
            {
              item: "spaghetti",
              quantity: { value: 200, valueText: "200", unit: "g" },
              scalable: true,
              confidence: 0.99,
            },
            {
              item: "tomatoes",
              preparation: "diced",
              quantity: { value: 2, valueText: "2", unit: null },
              scalable: true,
              confidence: 0.95,
            },
            {
              item: "salt",
              scalable: false,
              warnings: ["Seasoning should be adjusted by taste."],
            },
          ],
          steps: [
            { ingredientIndexes: [0], timers: [{ minutes: 10 }] },
            { ingredientIndexes: [1] },
          ],
        },
      })),
    };

    const recipe = await structureRecipeWithAi(baseRecipe, {
      ai,
    });

    expect(ai.run).toHaveBeenCalledWith(
      "@cf/zai-org/glm-4.7-flash",
      expect.objectContaining({
        response_format: expect.objectContaining({ type: "json_schema" }),
      }),
    );
    expect(recipe.ingredients[1]).toMatchObject({
      text: "2 tomatoes, diced",
      item: "tomatoes",
      preparation: "diced",
    });
    expect(recipe.steps[1]?.ingredientIds).toEqual(["ingredient-2"]);
    expect(recipe.ingredients[2]?.warnings).toContain(
      "Seasoning should be adjusted by taste.",
    );
  });
});
