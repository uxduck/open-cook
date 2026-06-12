import { describe, expect, it } from "vitest";
import { mapStashCookRows } from "./stashCookImporter";

describe("mapStashCookRows", () => {
  it("maps raw StashCook export rows into OpenCook recipes", () => {
    const recipes = mapStashCookRows([
      {
        id: "recipe-123",
        name: "Lemon Pasta",
        description: "Bright weeknight pasta",
        primaryImageUrl: "https://images.example.com/lemon-pasta.jpg",
        prepTimeMinutes: 10,
        cookTimeMinutes: 15,
        servings: "2",
        tags: [{ name: "Dinner" }, { name: "Pasta" }],
        ingredients2: [
          {
            amount: "200",
            unit: "g",
            productName: "spaghetti",
            comments: ["al dente shape"],
          },
          { amount: "1", productName: "lemon" },
        ],
        method: [{ text: "Boil the pasta." }, { text: "Toss with lemon." }],
        notes: [{ text: "Serve immediately." }],
      },
      null,
    ]);

    expect(recipes).toHaveLength(1);
    expect(recipes[0]).toMatchObject({
      id: "stashcook-recipe-123",
      title: "Lemon Pasta",
      description: "Bright weeknight pasta",
      imageUrl: "https://images.example.com/lemon-pasta.jpg",
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: "2",
      tags: ["Dinner", "Pasta"],
      ingredients: [
        { text: "200 g spaghetti", note: "al dente shape" },
        { text: "1 lemon" },
      ],
      steps: [{ text: "Boil the pasta." }, { text: "Toss with lemon." }],
      notes: ["Serve immediately."],
      source: {
        name: "StashCook",
        externalId: "recipe-123",
      },
    });
    expect(recipes[0]?.source?.raw).toMatchObject({ id: "recipe-123" });
  });
});
