import {
  ingredientBaseText,
  type Recipe,
  type RecipeImage,
  type RecipeIngredient,
  type SharedRecipe,
} from "@open-cook/core";
import { useEffect, useState } from "react";
import { buttonClassName } from "../ui";

export const githubUrl = "https://github.com/uxduck/open-cook";
export const xProfileUrl = "https://x.com/uxduck";
export const marketingSocialLinkClass =
  "inline-flex h-8 w-8 items-center justify-center text-(--foreground) opacity-75 transition hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--primary)";

export type Page = "recipes" | "api" | "export" | "build" | "settings";
export type AppRoute =
  | "home"
  | "app"
  | "addRecipe"
  | "login"
  | "register"
  | "recipeLink";
export type AuthIntent = "signup" | "login" | null;
export type RecipeSection = "mine" | "shared" | "explore";

export function sharedRecipeKey(recipe: SharedRecipe) {
  return `${recipe.owner.id}:${recipe.id}`;
}

export const emptyNoteClass =
  "col-span-full self-start rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-[13px] text-[var(--muted-foreground)]";
export const footnoteClass = "text-[13px] text-[var(--muted-foreground)]";
export const readOnlyListClass =
  "m-0 grid gap-[7px] pl-5 text-sm text-[var(--foreground)]";

export function visibilityPillClass(active: boolean) {
  return buttonClassName({
    active,
    className: "gap-1.5",
    size: "sm",
    variant: "tab",
  });
}

export const emptyRecipe: Recipe = {
  id: "",
  title: "",
  tags: [],
  ingredients: [],
  steps: [],
  notes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export type SaveState = "idle" | "saving" | "saved" | "error";

// The subset of a recipe that auto-save persists. Visibility is intentionally
// saved through the explicit sharing controls so stale autosaves cannot undo it.
export function recipeAutoSavePayload(recipe: Recipe) {
  return {
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    images: recipe.images,
    source: recipe.source,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    servings: recipe.servings,
    tags: recipe.tags,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
  };
}

export const recipeSavePayload = recipeAutoSavePayload;

// Gallery view of a recipe, folding the legacy single cover into a one-item list.
export function recipeImagesOf(
  recipe: Pick<Recipe, "images" | "imageUrl">,
): RecipeImage[] {
  if (recipe.images?.length) {
    return recipe.images;
  }
  return recipe.imageUrl ? [{ url: recipe.imageUrl }] : [];
}

export const demoRecipes: Recipe[] = [
  {
    id: "demo-halloumi-mango-tacos",
    title: "Crispy Halloumi Mango Tacos",
    description:
      "A sunny remix for kids, cousins, and anyone who wants dinner by hand.",
    imageUrl:
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=900&q=80",
    source: { name: "Family remix" },
    prepTimeMinutes: 18,
    cookTimeMinutes: 12,
    servings: "8 small tacos",
    tags: ["kids", "friends", "tacos"],
    ingredients: [
      { text: "Halloumi, sliced thick" },
      { text: "Mango, lime, coriander" },
      { text: "Warm tortillas and crunchy cabbage" },
    ],
    steps: [
      { text: "Pan-fry halloumi until deeply golden." },
      { text: "Toss mango with lime and coriander." },
      { text: "Fill tortillas with cabbage, halloumi, and salsa." },
    ],
    notes: ["Theme remix: the mango dragon guards the last taco."],
    createdAt: "2026-06-10T08:00:00.000Z",
    updatedAt: "2026-06-10T08:00:00.000Z",
  },
  {
    id: "demo-ramen-night",
    title: "Rainy Day Sesame Ramen",
    description: "A low-effort bowl that turns leftovers into something cozy.",
    imageUrl:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
    source: { name: "Generated remix" },
    prepTimeMinutes: 10,
    cookTimeMinutes: 18,
    servings: "3 bowls",
    tags: ["cozy", "quick", "leftovers"],
    ingredients: [
      { text: "Noodles and sesame broth" },
      { text: "Jammy eggs or tofu" },
      { text: "Any leftover greens" },
    ],
    steps: [
      { text: "Warm the broth with ginger and sesame." },
      { text: "Cook noodles until springy." },
      { text: "Top each bowl with greens and a soft egg." },
    ],
    notes: ["Remix: make it low-effort for a rainy Tuesday."],
    createdAt: "2026-06-10T08:00:00.000Z",
    updatedAt: "2026-06-10T08:00:00.000Z",
  },
  {
    id: "demo-lemon-ricotta-gnocchi",
    title: "Lemon Ricotta Gnocchi Bake",
    description:
      "A bright old-favorite restyle that feels special without a long prep list.",
    imageUrl:
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
    source: { name: "Imported favorite" },
    prepTimeMinutes: 14,
    cookTimeMinutes: 22,
    servings: "4",
    tags: ["family", "pasta", "comfort"],
    ingredients: [
      { text: "Gnocchi and ricotta" },
      { text: "Lemon zest and peas" },
      { text: "Parmesan and basil" },
    ],
    steps: [
      { text: "Fold gnocchi with ricotta, lemon, and peas." },
      { text: "Bake until bubbling at the edges." },
      { text: "Finish with parmesan and torn basil." },
    ],
    notes: ["Theme: make it birthday-table friendly for cousins."],
    createdAt: "2026-06-10T08:00:00.000Z",
    updatedAt: "2026-06-10T08:00:00.000Z",
  },
];

export const marketingPreviewRecipes = demoRecipes;
export const recipeSearchDebounceMs = 350;
export const recipeAutoSaveDebounceMs = 700;

export const remixPromptExamples = [
  "Theme the gnocchi bake for Halloween",
  "Make the halloumi tacos a dragon party",
  "Adapt the lemon pasta to be vegan",
  "Write a bedtime story for the ramen",
] as const;

export const remixDemoResultTitles = [
  "Haunted Gnocchi Bake",
  "Dragon-Party Halloumi Tacos",
  "Vegan Lemon Pasta",
  "The Tale of Sleepy Ramen",
] as const;

export const importSourceLabels = [
  "StashCook exports",
  "recipe links",
  "Markdown notes",
  "JSON files",
  "family docs",
] as const;

export const themeExamples = [
  "for the kids",
  "Halloween",
  "Harry Potter feast",
  "dragon party",
  "vegan",
  "dinner party",
] as const;

export function remixPromptAt(index: number) {
  return remixPromptExamples[index] ?? remixPromptExamples[0];
}

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

export function ingredientWithText(ingredient: RecipeIngredient): RecipeIngredient {
  return {
    ...ingredient,
    text: ingredientBaseText(ingredient),
  };
}

export function hasIngredientStructure(ingredient: RecipeIngredient) {
  return Boolean(
    ingredient.quantity ||
    ingredient.item ||
    ingredient.preparation ||
    ingredient.note ||
    ingredient.scalable !== undefined ||
    ingredient.confidence !== undefined ||
    ingredient.warnings?.length,
  );
}

export function recipeTimeSummary(recipe: Recipe) {
  const prep = recipe.prepTimeMinutes ?? 0;
  const cook = recipe.cookTimeMinutes ?? 0;
  const total = prep + cook;

  if (total > 0) {
    return `${total} min total`;
  }

  return "time unset";
}

export function optionalNumber(value: string) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function optionalQuantity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(trimmed);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }

  const fraction = /^(\d+)\/(\d+)$/.exec(trimmed);
  if (fraction) {
    return Number(fraction[1]) / Number(fraction[2]);
  }

  return optionalNumber(trimmed);
}

export function recipesFromStashCookExport(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isObjectRecord(value)) {
    for (const key of ["recipes", "results", "items", "data"]) {
      const candidate = value[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error("Upload StashCook recipes.json or JSON with a recipes array.");
}

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function previewText(value: string, maxLength = 12000) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n\n... truncated ${
    value.length - maxLength
  } characters. Use the download link for the full export.`;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
