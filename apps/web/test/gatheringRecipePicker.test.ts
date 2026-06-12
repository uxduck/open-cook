import type { Recipe } from "@open-cook/core";
import { describe, expect, it } from "vitest";
import {
  gatheringRecipeAutoPickCount,
  gatheringRecipePickerAutoPickIds,
  gatheringRecipePickerMatches,
  gatheringRecipePickerPageSize,
  nextGatheringRecipePickerCount,
} from "../src/components/recipeGenerator";

function recipe(id: number, title = `Recipe ${id}`): Recipe {
  return {
    id: `recipe-${id}`,
    title,
    tags: [],
    ingredients: [],
    steps: [],
    notes: [],
    createdAt: "2026-06-10T08:00:00.000Z",
    updatedAt: "2026-06-10T08:00:00.000Z",
  };
}

describe("gathering recipe picker", () => {
  it("keeps all recipes available beyond the first page", () => {
    const recipes = Array.from({ length: gatheringRecipePickerPageSize + 3 }, (_, i) =>
      recipe(i + 1),
    );

    const matches = gatheringRecipePickerMatches(recipes, "");
    const nextCount = nextGatheringRecipePickerCount(
      gatheringRecipePickerPageSize,
      matches.length,
    );

    expect(matches).toHaveLength(gatheringRecipePickerPageSize + 3);
    expect(matches.slice(0, gatheringRecipePickerPageSize)).toHaveLength(
      gatheringRecipePickerPageSize,
    );
    expect(matches.slice(0, nextCount)).toHaveLength(matches.length);
  });

  it("filters before paging the picker", () => {
    const recipes = [
      recipe(1, "Miso aubergine"),
      recipe(2, "Lemon pasta"),
      recipe(3, "Miso soup"),
    ];

    expect(
      gatheringRecipePickerMatches(recipes, "miso").map((item) => item.id),
    ).toEqual(["recipe-1", "recipe-3"]);
  });

  it("auto-picks the first matching recipes for creator setup", () => {
    const recipes = Array.from({ length: gatheringRecipeAutoPickCount + 2 }, (_, i) =>
      recipe(i + 1),
    );

    expect(gatheringRecipePickerAutoPickIds(recipes)).toEqual([
      "recipe-1",
      "recipe-2",
      "recipe-3",
      "recipe-4",
    ]);
    expect(gatheringRecipePickerAutoPickIds(recipes, 2)).toEqual([
      "recipe-1",
      "recipe-2",
    ]);
  });
});
