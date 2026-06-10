import type { Recipe } from "@open-cook/core";
import { describe, expect, it } from "vitest";
import { recipeAutoSavePayload } from "../src/lib/recipe";

const recipe: Recipe = {
  id: "r1",
  title: "Miso aubergine",
  description: "Sticky and smoky.",
  imageUrl: "https://example.com/aubergine.jpg",
  tags: ["dinner"],
  ingredients: [{ text: "Aubergine" }],
  steps: [{ text: "Roast until glossy." }],
  notes: ["Serve with rice."],
  visibility: "public",
  createdAt: "2026-06-10T08:00:00.000Z",
  updatedAt: "2026-06-10T08:00:00.000Z",
};

describe("recipeAutoSavePayload", () => {
  it("does not autosave visibility", () => {
    expect(recipeAutoSavePayload(recipe)).not.toHaveProperty("visibility");
  });

  it("keeps editable recipe content in the autosave payload", () => {
    expect(recipeAutoSavePayload(recipe)).toMatchObject({
      description: "Sticky and smoky.",
      ingredients: [{ text: "Aubergine" }],
      notes: ["Serve with rice."],
      steps: [{ text: "Roast until glossy." }],
      title: "Miso aubergine",
    });
  });
});
