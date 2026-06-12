import {
  defaultFoodPreferences,
  type FoodPreferences,
  type Recipe,
} from "@open-cook/core";
import { describe, expect, it } from "vitest";
import { recommendRecipesDeterministically } from "./recipeRecommendations";

function recipe(
  id: string,
  title: string,
  input: Partial<Recipe> = {},
): Recipe {
  return {
    id,
    title,
    createdAt: "2026-06-10T08:00:00.000Z",
    ingredients: [],
    notes: [],
    steps: [],
    tags: [],
    updatedAt: "2026-06-10T08:00:00.000Z",
    ...input,
  };
}

describe("recipe recommendations", () => {
  it("skips recipes that conflict with allergies and diet pattern", () => {
    const preferences: FoodPreferences = {
      ...defaultFoodPreferences,
      allergies: ["Peanuts"],
      dietPattern: "vegetarian",
      maxCookTimeMinutes: 60,
    };

    const result = recommendRecipesDeterministically({
      preferences,
      recipes: [
        recipe("peanut-noodles", "Peanut noodles", {
          ingredients: [{ text: "2 tbsp peanut butter" }],
        }),
        recipe("chicken-soup", "Chicken soup", {
          ingredients: [{ text: "500g chicken thighs" }],
        }),
        recipe("tomato-pasta", "Tomato pasta", {
          ingredients: [{ text: "Tomatoes" }, { text: "Pasta" }],
        }),
      ],
    });

    expect(result.recipeIds).toEqual(["tomato-pasta"]);
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "peanut-noodles" }),
        expect.objectContaining({ id: "chicken-soup" }),
      ]),
    );
    expect(result.warnings).toHaveLength(1);
  });

  it("ranks recipes using favorites, gathering context, and cook time", () => {
    const preferences: FoodPreferences = {
      ...defaultFoodPreferences,
      cookingGoals: ["Quick and easy"],
      favoriteCuisines: ["Italian"],
      favoriteIngredients: ["Tomatoes"],
      maxCookTimeMinutes: 45,
    };

    const result = recommendRecipesDeterministically({
      context: { prompt: "garden lunch with tomato dishes" },
      count: 2,
      preferences,
      recipes: [
        recipe("bean-stew", "Bean stew", {
          ingredients: [{ text: "Beans" }],
          totalTimeMinutes: 40,
        }),
        recipe("tomato-risotto", "Tomato risotto", {
          ingredients: [{ text: "Fresh tomatoes" }],
          tags: ["Italian"],
          totalTimeMinutes: 30,
        }),
        recipe("roast-potatoes", "Roast potatoes", {
          ingredients: [{ text: "Potatoes" }],
          totalTimeMinutes: 45,
        }),
      ],
    });

    expect(result.recipeIds).toEqual(["tomato-risotto", "bean-stew"]);
    expect(result.recommendations[0]?.reasons).toEqual(
      expect.arrayContaining([
        "Uses favorite ingredient: Tomatoes",
        "Matches favorite cuisine: Italian",
      ]),
    );
  });
});
