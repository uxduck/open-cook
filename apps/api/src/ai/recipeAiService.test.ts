import { createRecipeRecord } from "@open-cook/core";
import { describe, expect, it } from "vitest";
import type { ImageAssetStore } from "../assets/imageAssets";
import {
  createRecipeAiService,
  type RecipeAiBinding,
  RecipeAiUnavailableError,
} from "./recipeAiService";

const testRecipe = createRecipeRecord({
  title: "Tomato pasta",
  servings: "2",
  tags: ["dinner"],
  ingredients: [{ text: "200g pasta" }, { text: "1 cup tomato sauce" }],
  steps: [{ text: "Boil pasta." }, { text: "Warm sauce and toss together." }],
  notes: [],
});

const disabledAssets: ImageAssetStore = {
  adapter: "disabled",
  canStore: false,
  isManagedUrl: () => false,
  publicUrlForKey: (key) => `https://images.example.com/${key}`,
  readImage: async () => null,
  storeImageBytes: async () => {
    throw new Error("not configured");
  },
  storeImageFromUrl: async () => {
    throw new Error("not configured");
  },
};

describe("createRecipeAiService", () => {
  it("uses Workers AI as the text remix fallback", async () => {
    const ai: RecipeAiBinding = {
      async run(model, input) {
        expect(model).toBe("@cf/zai-org/glm-4.7-flash");
        expect(input.response_format).toMatchObject({
          type: "json_schema",
        });

        return {
          response: JSON.stringify({
            draft: {
              title: "Moon Tomato Pasta",
              tags: ["dinner", "children"],
              ingredients: [{ text: "200g pasta" }, { text: "1 cup tomato sauce" }],
              steps: [
                { text: "Ask an adult to boil the pasta." },
                { text: "Stir in the tomato sauce." },
              ],
              notes: ["Serve in small bowls."],
            },
            changes: ["Made the method more child-facing."],
            safetyNotes: ["An adult should handle boiling water."],
            imagePrompt: "A playful bowl of tomato pasta shaped like a moon.",
          }),
        };
      },
    };

    const service = createRecipeAiService({
      assets: disabledAssets,
      env: {
        AI: ai,
      },
    });

    const result = await service.remixRecipe({
      audience: "children",
      includeImagePrompt: true,
      prompt: "Make this feel like a moon dinner for kids.",
      recipe: testRecipe,
    });

    expect(result.provider).toEqual({
      provider: "workers-ai",
      model: "@cf/zai-org/glm-4.7-flash",
    });
    expect(result.draft.title).toBe("Moon Tomato Pasta");
    expect(result.safetyNotes).toContain("An adult should handle boiling water.");
  });

  it("parses chat completion output for recipe remixes", async () => {
    const ai: RecipeAiBinding = {
      async run(model, input) {
        expect(model).toBe("@cf/zai-org/glm-4.7-flash");
        expect(input.response_format).toMatchObject({
          json_schema: {
            name: "RecipeRemix",
          },
          type: "json_schema",
        });

        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  draft: {
                    title: "Rocket Tomato Pasta",
                    tags: ["dinner", "family"],
                    ingredients: [
                      { text: "200g pasta" },
                      { text: "1 cup tomato sauce" },
                    ],
                    steps: [
                      { text: "Boil the pasta." },
                      { text: "Toss with warm sauce." },
                    ],
                    notes: ["Serve right away."],
                  },
                  changes: ["Used the current default model output shape."],
                  safetyNotes: [],
                }),
              },
            },
          ],
        };
      },
    };

    const service = createRecipeAiService({
      assets: disabledAssets,
      env: {
        AI: ai,
      },
    });

    const result = await service.remixRecipe({
      prompt: "Make this feel like a rocket dinner for families.",
      recipe: testRecipe,
    });

    expect(result.provider).toEqual({
      provider: "workers-ai",
      model: "@cf/zai-org/glm-4.7-flash",
    });
    expect(result.draft.title).toBe("Rocket Tomato Pasta");
  });

  it("generates recipe images with Workers AI and stores the decoded bytes", async () => {
    const stored: { contentType?: string; size?: number; sourceUrl?: string } = {};
    const ai: RecipeAiBinding = {
      async run(model, input) {
        expect(model).toBe("@cf/black-forest-labs/flux-2-klein-9b");
        expect(input.multipart).toMatchObject({
          contentType: expect.stringContaining("multipart/form-data"),
        });

        return {
          image: "AQIDBA==",
        };
      },
    };
    const assets: ImageAssetStore = {
      ...disabledAssets,
      canStore: true,
      storeImageBytes: async (bytes, options) => {
        const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        stored.contentType = options.contentType;
        stored.size = view.byteLength;
        stored.sourceUrl = options.sourceUrl;

        return {
          contentType: options.contentType,
          key: "tomato-pasta-test.jpg",
          size: view.byteLength,
          sourceUrl: options.sourceUrl ?? "generated",
          url: "https://images.example.com/tomato-pasta-test.jpg",
        };
      },
    };

    const service = createRecipeAiService({
      assets,
      env: {
        AI: ai,
      },
    });

    const result = await service.generateRecipeImage({
      prompt: "A bright bowl of tomato pasta.",
      recipe: {
        ingredients: testRecipe.ingredients,
        notes: testRecipe.notes,
        steps: testRecipe.steps,
        tags: testRecipe.tags,
        title: testRecipe.title,
      },
      steps: 6,
    });

    expect(result).toMatchObject({
      contentType: "image/jpeg",
      provider: {
        model: "@cf/black-forest-labs/flux-2-klein-9b",
        provider: "workers-ai",
      },
      size: 4,
      url: "https://images.example.com/tomato-pasta-test.jpg",
    });
    expect(stored).toEqual({
      contentType: "image/jpeg",
      size: 4,
      sourceUrl: "ai:workers-ai:@cf/black-forest-labs/flux-2-klein-9b",
    });
  });

  it("reports missing provider configuration", async () => {
    const service = createRecipeAiService({
      assets: disabledAssets,
      env: {},
    });

    await expect(
      service.remixRecipe({
        prompt: "Make this faster.",
        recipe: testRecipe,
      }),
    ).rejects.toBeInstanceOf(RecipeAiUnavailableError);
  });
});
