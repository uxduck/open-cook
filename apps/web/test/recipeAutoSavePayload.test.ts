import type { Recipe } from "@open-cook/core";
import { describe, expect, it } from "vitest";
import {
  ingredientDisplayNote,
  recipeAutoSavePayload,
  recipeShareLinkState,
} from "../src/lib/recipe";

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

describe("recipeShareLinkState", () => {
  it("does not expose a candidate link while visibility is still saving", () => {
    expect(
      recipeShareLinkState({
        origin: "http://127.0.0.1:5173",
        ownerUserId: "user-1",
        persistedVisibility: "private",
        recipeId: "recipe-1",
        visibility: "public",
      }),
    ).toEqual({
      hasUnsavedVisibility: true,
      shareLink: "",
    });
  });

  it("returns a copyable link after shareable visibility has been saved", () => {
    expect(
      recipeShareLinkState({
        origin: "http://127.0.0.1:5173",
        ownerUserId: "user-1",
        persistedVisibility: "public",
        recipeId: "recipe-1",
        visibility: "public",
      }),
    ).toEqual({
      hasUnsavedVisibility: false,
      shareLink: "http://127.0.0.1:5173/r/user-1/recipe-1",
    });
  });
});

describe("ingredientDisplayNote", () => {
  it("hides StashCook comments already present in the ingredient text", () => {
    expect(
      ingredientDisplayNote({
        text: "2 or 3 Aubergines",
        item: "or 3 Aubergines",
        note: "or 3 Aubergines",
      }),
    ).toBeUndefined();
  });

  it("shows source notes that add information", () => {
    expect(
      ingredientDisplayNote({
        text: "200 g spaghetti",
        note: "use bronze-cut if available",
      }),
    ).toBe("use bronze-cut if available");
  });
});
