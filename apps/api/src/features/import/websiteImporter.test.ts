import { describe, expect, it, vi } from "vitest";
import { importRecipeFromWebsite } from "./websiteImporter";

describe("importRecipeFromWebsite", () => {
  it("imports schema.org Recipe JSON-LD without using Workers AI", async () => {
    const fetcher = htmlFetcher(`
      <html>
        <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Tomato Toast",
            "recipeIngredient": ["1 slice sourdough", "2 tomatoes"],
            "recipeInstructions": [{"text": "Toast bread."}, {"text": "Add tomatoes."}],
            "totalTime": "PT10M"
          }
        </script>
      </html>
    `);
    const ai = {
      run: vi.fn(async () => ({ response: "{}" })),
    };

    const recipe = await importRecipeFromWebsite(
      { url: "https://recipes.example.com/tomato-toast" },
      { ai, fetcher },
    );

    expect(ai.run).not.toHaveBeenCalled();
    expect(recipe).toMatchObject({
      title: "Tomato Toast",
      totalTimeMinutes: 10,
      ingredients: [{ text: "1 slice sourdough" }, { text: "2 tomatoes" }],
      steps: [{ text: "Toast bread." }, { text: "Add tomatoes." }],
      source: {
        name: "recipes.example.com",
        url: "https://recipes.example.com/tomato-toast",
      },
    });
  });

  it("decodes HTML entities from schema.org Recipe JSON-LD text", async () => {
    const fetcher = htmlFetcher(`
      <html>
        <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Miso Aubergine &amp; Rice",
            "description": "Even if you don&#39;t usually love aubergine, you&#39;ll love this.",
            "recipeIngredient": ["2 aubergines &amp; miso"],
            "recipeInstructions": [{"text": "Don&#39;t burn the glaze."}],
            "keywords": "easy &amp; savoury"
          }
        </script>
      </html>
    `);

    const recipe = await importRecipeFromWebsite(
      { url: "https://recipes.example.com/miso-aubergine" },
      { fetcher },
    );

    expect(recipe).toMatchObject({
      title: "Miso Aubergine & Rice",
      description: "Even if you don't usually love aubergine, you'll love this.",
      tags: ["easy & savoury"],
      ingredients: [{ text: "2 aubergines & miso" }],
      steps: [{ text: "Don't burn the glaze." }],
    });
  });

  it("falls back to Workers AI when the page has no recipe JSON-LD", async () => {
    const fetcher = htmlFetcher(`
      <html>
        <head>
          <title>Lemon Pasta</title>
          <meta property="og:image" content="/lemon.jpg">
        </head>
        <body>
          <h1>Lemon Pasta</h1>
          <h2>Ingredients</h2>
          <ul><li>200 g spaghetti</li><li>1 lemon</li></ul>
          <h2>Method</h2>
          <ol><li>Boil the pasta.</li><li>Toss with lemon.</li></ol>
        </body>
      </html>
    `);
    const ai = {
      run: vi.fn(async () => ({
        response: JSON.stringify({
          title: "Lemon Pasta",
          servings: "2",
          tags: ["Dinner"],
          ingredients: ["200 g spaghetti", "1 lemon"],
          steps: ["Boil the pasta.", "Toss with lemon."],
          totalTimeMinutes: "20 minutes",
        }),
      })),
    };

    const recipe = await importRecipeFromWebsite(
      { url: "https://recipes.example.com/lemon-pasta" },
      { ai, fetcher },
    );

    expect(ai.run).toHaveBeenCalledWith(
      "@cf/zai-org/glm-4.7-flash",
      expect.objectContaining({
        max_completion_tokens: 1800,
        response_format: expect.objectContaining({ type: "json_schema" }),
        temperature: 0.1,
      }),
    );
    expect(recipe).toMatchObject({
      title: "Lemon Pasta",
      imageUrl: "https://recipes.example.com/lemon.jpg",
      servings: "2",
      tags: ["Dinner"],
      totalTimeMinutes: 20,
      ingredients: [{ text: "200 g spaghetti" }, { text: "1 lemon" }],
      steps: [{ text: "Boil the pasta." }, { text: "Toss with lemon." }],
      source: {
        raw: {
          extraction: "workers-ai",
          model: "@cf/zai-org/glm-4.7-flash",
        },
      },
    });
  });

  it("reports missing AI configuration when no structured recipe is available", async () => {
    await expect(
      importRecipeFromWebsite(
        { url: "https://recipes.example.com/no-structured-data" },
        { fetcher: htmlFetcher("<html><title>No recipe data</title></html>") },
      ),
    ).rejects.toThrow("Workers AI is not configured");
  });
});

function htmlFetcher(html: string): typeof fetch {
  return async () =>
    new Response(html, {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });
}
