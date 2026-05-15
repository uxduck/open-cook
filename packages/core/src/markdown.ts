import type { CreateRecipeInput, Recipe } from "./recipe";

const frontmatterEscape = (value: string) => value.replaceAll('"', '\\"');

function listLines(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function recipeToMarkdown(recipe: Recipe) {
  const lines = [
    "---",
    `id: "${frontmatterEscape(recipe.id)}"`,
    `title: "${frontmatterEscape(recipe.title)}"`,
    recipe.source?.url ? `sourceUrl: "${frontmatterEscape(recipe.source.url)}"` : "",
    recipe.source?.name ? `sourceName: "${frontmatterEscape(recipe.source.name)}"` : "",
    recipe.servings ? `servings: "${frontmatterEscape(recipe.servings)}"` : "",
    `tags: [${recipe.tags.map((tag) => `"${frontmatterEscape(tag)}"`).join(", ")}]`,
    "---",
    "",
    `# ${recipe.title}`,
    "",
    recipe.description ?? "",
    "",
    "## Timing",
    "",
    recipe.prepTimeMinutes ? `- Prep: ${recipe.prepTimeMinutes} minutes` : "",
    recipe.cookTimeMinutes ? `- Cook: ${recipe.cookTimeMinutes} minutes` : "",
    recipe.totalTimeMinutes ? `- Total: ${recipe.totalTimeMinutes} minutes` : "",
    recipe.servings ? `- Servings: ${recipe.servings}` : "",
    "",
    "## Ingredients",
    "",
    listLines(recipe.ingredients.map((ingredient) => ingredient.text)),
    "",
    "## Method",
    "",
    recipe.steps.map((step, index) => `${index + 1}. ${step.text}`).join("\n"),
    "",
    recipe.notes.length ? "## Notes" : "",
    "",
    recipe.notes.length ? listLines(recipe.notes) : "",
  ];

  return `${lines
    .filter((line, index, all) => {
      if (line !== "") {
        return true;
      }
      return all[index - 1] !== "" && all[index + 1] !== "";
    })
    .join("\n")}\n`;
}

export function recipesToMarkdown(recipes: Recipe[]) {
  return recipes.map(recipeToMarkdown).join("\n---\n\n");
}

export function parseRecipeMarkdown(markdown: string): CreateRecipeInput {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || "Untitled recipe";
  const ingredientsBlock = extractSection(markdown, "Ingredients");
  const methodBlock = extractSection(markdown, "Method");
  const notesBlock = extractSection(markdown, "Notes");
  const sourceUrl = markdown.match(/^sourceUrl:\s*"([^"]+)"/m)?.[1];
  const sourceName = markdown.match(/^sourceName:\s*"([^"]+)"/m)?.[1];

  return {
    title,
    source:
      sourceUrl || sourceName
        ? {
            name: sourceName,
            url: sourceUrl,
          }
        : undefined,
    ingredients: ingredientsBlock
      .split("\n")
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean)
      .map((text) => ({ text })),
    steps: methodBlock
      .split("\n")
      .map((line) => line.replace(/^\d+[.)]\s+/, "").trim())
      .filter(Boolean)
      .map((text) => ({ text })),
    notes: notesBlock
      .split("\n")
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean),
    tags: [],
  };
}

function extractSection(markdown: string, heading: string) {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, "im");
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}
