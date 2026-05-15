import type { CreateRecipeInput, Recipe, UpdateRecipeInput } from "@open-cook/core";

type ImportResult = {
  created: number;
  updated: number;
  recipes: Recipe[];
};

type MirrorImagesResult = {
  failed: number;
  updated: number;
  skipped: number;
  recipes: Recipe[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: "ok"; name: string; version: string }>("/api/health"),
  listRecipes: (query?: string) =>
    request<Recipe[]>(
      query ? `/api/recipes?q=${encodeURIComponent(query)}` : "/api/recipes",
    ),
  createRecipe: (recipe: CreateRecipeInput) =>
    request<Recipe>("/api/recipes", {
      body: JSON.stringify(recipe),
      method: "POST",
    }),
  updateRecipe: (id: string, recipe: UpdateRecipeInput) =>
    request<Recipe>(`/api/recipes/${id}`, {
      body: JSON.stringify(recipe),
      method: "PUT",
    }),
  deleteRecipe: (id: string) =>
    request<void>(`/api/recipes/${id}`, {
      method: "DELETE",
    }),
  importWebsite: (url: string) =>
    request<Recipe>("/api/import/website", {
      body: JSON.stringify({ url }),
      method: "POST",
    }),
  importMarkdown: (markdown: string) =>
    request<Recipe>("/api/import/markdown", {
      body: JSON.stringify({ markdown }),
      method: "POST",
    }),
  importStashCook: (payload: {
    bearerToken?: string;
    cookie?: string;
    take?: number;
  }) =>
    request<ImportResult>("/api/import/stashcook", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  mirrorRecipeImages: () =>
    request<MirrorImagesResult>("/api/assets/images/mirror-recipes", {
      method: "POST",
    }),
};
