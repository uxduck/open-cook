import { describe, expect, it } from "vitest";
import { ingredientDisplayText } from "./recipeStructure";

describe("ingredientDisplayText", () => {
  it("keeps ingredient text when an unstructured ingredient has a note", () => {
    expect(
      ingredientDisplayText({
        text: "200 g spaghetti",
        note: "use bronze-cut if available",
      }),
    ).toBe("200 g spaghetti (use bronze-cut if available)");
  });

  it("can omit the note for secondary-note layouts", () => {
    expect(
      ingredientDisplayText(
        {
          text: "200 g spaghetti",
          note: "use bronze-cut if available",
        },
        1,
        { includeNote: false },
      ),
    ).toBe("200 g spaghetti");
  });
});
