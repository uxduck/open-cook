import {
  decodeRecipeText,
  type CreateRecipeInput,
  type FoodPreferences,
  type Gathering,
  type GatheringGuestResponse,
  type GeneratedRecipeImage,
  type PublicGathering,
  type Recipe,
  type RecipeAiAudience,
  type RecipeAiProviderMetadata,
  type RecipeCookProgress,
  type RecipeCookProgressInput,
  type RecipeDraft,
  type RecipeRemixResult,
  type RecipeShare,
  type SharedRecipe,
  type UpdateRecipeInput,
  type UserFoodPreferences,
  type UserFoodPreferencesLookup,
} from "@open-cook/core";

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

export type ImageAsset = {
  key: string;
  url: string;
  sourceUrl: string;
  contentType: string;
  size: number;
};

export type ApiInfo = {
  product: string;
  description: string;
  version: string;
  apiBasePath: string;
  docsPath: string;
  scalarPath: string;
  openapiPath: string;
  storage: {
    adapter: string;
    replaceable: boolean;
  };
  auth: {
    adapter: string;
    methods: string[];
  };
  imageAssets: {
    adapter: string;
    publicBaseUrl: string;
    publicRoute: string;
  };
};

export type AgentManifest = {
  name: string;
  openapiPath: string;
  recommendedUse: string[];
  tools: Array<{
    method: string;
    path: string;
    description: string;
  }>;
  workflows: Array<{
    method: string;
    path: string;
    description: string;
  }>;
};

export type OpenApiDocument = {
  info?: {
    description?: string;
    title?: string;
    version?: string;
  };
  openapi?: string;
  paths?: Record<string, unknown>;
};

export type ShoppingListResult = {
  recipeCount: number;
  items: Array<{
    text: string;
    recipes: string[];
  }>;
};

export type RecipeSearchResult = {
  query: {
    q?: string;
    tag?: string;
    source?: string;
    limit: number;
  };
  count: number;
  returned: number;
  recipes: Array<{
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    servings?: string;
    totalTimeMinutes?: number;
    tags: string[];
    source?: {
      name?: string;
      url?: string;
      externalId?: string;
    };
    matchedFields: string[];
    ingredientMatches: string[];
    score: number;
    ingredients?: string[];
    steps?: string[];
  }>;
};

export type RecipeStructureResult = {
  recipe: Recipe;
  summary: {
    ingredients: number;
    steps: number;
    warnings: string[];
  };
};

export type RecipeRemixApiResult = RecipeRemixResult & {
  provider: RecipeAiProviderMetadata;
};

export type BillingCreditBalance = {
  currencyKey: string;
  available: number;
  total: number;
};

export type BillingSummary = {
  plan: string;
  balances: BillingCreditBalance[];
  billingEnabled: boolean;
};

export type CheckoutTarget = "pro" | "credits_5" | "credits_10";

export type RecipeRemixPayload = {
  recipeId?: string;
  recipe?: Recipe;
  prompt: string;
  audience?: RecipeAiAudience;
  theme?: string;
  includeImagePrompt?: boolean;
};

export type GatheringDraftPayload = {
  title?: string;
  prompt?: string;
  dietary?: string;
  guestQuestion?: string;
  recipeIds: string[];
};

export type GatheringDraftResult = {
  title: string;
  welcome: string;
  guestQuestion: string;
  provider: {
    provider: "workers-ai" | "template";
    model?: string;
  };
};

export type GatheringRecipeRecommendationPayload = {
  title?: string;
  prompt?: string;
  dietary?: string;
  guestQuestion?: string;
  query?: string;
  count?: number;
  candidateRecipeIds?: string[];
};

export type GatheringRecipeRecommendationResult = {
  recipeIds: string[];
  recommendations: Array<{
    id: string;
    title: string;
    score: number;
    reasons: string[];
  }>;
  rejectedCount: number;
  warnings: string[];
  provider: {
    provider: "deterministic" | "workers-ai";
    model?: string;
  };
};

export type PublishGatheringPayload = {
  title: string;
  prompt?: string;
  welcome: string;
  dietary?: string;
  guestQuestion: string;
  recipeIds: string[];
  inviteeEmails?: string[];
};

export type SaveGatheringPayload = {
  title?: string;
  prompt?: string;
  welcome?: string;
  dietary?: string;
  guestQuestion?: string;
  recipeIds?: string[];
  inviteeEmails?: string[];
};

export type PublishGatheringResult = {
  gathering: Gathering;
  url: string;
};

export type SendGatheringInvitesPayload = {
  inviteeEmails: string[];
};

export type SendGatheringInvitesResult = {
  gathering: Gathering;
  sentCount: number;
  url: string;
};

export type GatheringArtifactId =
  | "menu-images"
  | "page-artwork"
  | "voiceover"
  | "video-teaser";

export type GatheringArtifactJob = {
  id: GatheringArtifactId;
  label: string;
  provider: "elevenlabs" | "fal";
  status: "ready" | "submitted" | "skipped" | "failed";
  audioUrl?: string;
  mediaUrl?: string;
  contentType?: string;
  size?: number;
  model?: string;
  requestId?: string;
  voiceId?: string;
  voiceName?: string;
  statusUrl?: string;
  responseUrl?: string;
  cancelUrl?: string;
  error?: string;
};

export type GenerateGatheringArtifactsPayload = {
  title?: string;
  prompt?: string;
  welcome?: string;
  dietary?: string;
  guestQuestion?: string;
  recipeIds: string[];
};

export type GenerateGatheringArtifactsResult = {
  jobs: GatheringArtifactJob[];
};

export type GatheringGuestResponsePayload = {
  guestName: string;
  email?: string;
  selectedRecipeIds: string[];
  bringing?: string;
  note?: string;
};

export type ApiErrorReason = "recipe_limit" | "restyle_quota" | string;

/** Error thrown by API calls, carrying the HTTP status and any machine-readable
 * `reason` (e.g. "recipe_limit", "restyle_quota") so callers can show upgrade prompts. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: ApiErrorReason,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const gatheringLoadTimeoutMs = 10_000;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

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
    throw new ApiError(
      body?.error ?? `${response.status} ${response.statusText}`,
      response.status,
      body?.reason,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function requestWithTimeout<T>(
  path: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await request<T>(path, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("Request timed out. Try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
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

  return response.text();
}

function decodeRecipeList<T extends Recipe>(recipes: T[]): T[] {
  return recipes.map(decodeRecipeText);
}

function decodeImportResult(result: ImportResult): ImportResult {
  return { ...result, recipes: decodeRecipeList(result.recipes) };
}

function decodeMirrorImagesResult(result: MirrorImagesResult): MirrorImagesResult {
  return { ...result, recipes: decodeRecipeList(result.recipes) };
}

function decodeStructureResult(result: RecipeStructureResult): RecipeStructureResult {
  return { ...result, recipe: decodeRecipeText(result.recipe) };
}

async function requestRecipe<T extends Recipe>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return decodeRecipeText(await request<T>(path, init));
}

async function requestRecipes<T extends Recipe>(
  path: string,
  init?: RequestInit,
): Promise<T[]> {
  return decodeRecipeList(await request<T[]>(path, init));
}

export const api = {
  health: () => request<{ status: "ok"; name: string; version: string }>("/api/health"),
  info: () => request<ApiInfo>("/api/info"),
  openApi: () => request<OpenApiDocument>("/openapi.json"),
  agentManifest: () => request<AgentManifest>("/api/agents/manifest"),
  listRecipes: (query?: string) =>
    requestRecipes<Recipe>(
      query ? `/api/recipes?q=${encodeURIComponent(query)}` : "/api/recipes",
    ),
  createRecipe: (recipe: CreateRecipeInput) =>
    requestRecipe<Recipe>("/api/recipes", {
      body: JSON.stringify(recipe),
      method: "POST",
    }),
  updateRecipe: (id: string, recipe: UpdateRecipeInput) =>
    requestRecipe<Recipe>(`/api/recipes/${id}`, {
      body: JSON.stringify(recipe),
      method: "PUT",
    }),
  deleteRecipe: (id: string) =>
    request<void>(`/api/recipes/${id}`, {
      method: "DELETE",
    }),
  getRecipeCookProgress: (id: string) =>
    request<RecipeCookProgress>(`/api/recipes/${id}/progress`),
  updateRecipeCookProgress: (id: string, progress: RecipeCookProgressInput) =>
    request<RecipeCookProgress>(`/api/recipes/${id}/progress`, {
      body: JSON.stringify(progress),
      method: "PUT",
    }),
  resetRecipeCookProgress: (id: string) =>
    request<void>(`/api/recipes/${id}/progress`, {
      method: "DELETE",
    }),
  listSharedRecipes: () => requestRecipes<SharedRecipe>("/api/recipes/shared-with-me"),
  markSharedRecipeSeen: (ownerId: string, recipeId: string) =>
    requestRecipe<SharedRecipe>(
      `/api/recipes/shared-with-me/${encodeURIComponent(ownerId)}/${encodeURIComponent(recipeId)}/seen`,
      { method: "POST" },
    ),
  dismissSharedRecipe: (ownerId: string, recipeId: string) =>
    request<void>(
      `/api/recipes/shared-with-me/${encodeURIComponent(ownerId)}/${encodeURIComponent(recipeId)}`,
      { method: "DELETE" },
    ),
  listPublicRecipes: (query?: string) =>
    requestRecipes<SharedRecipe>(
      query
        ? `/api/recipes/public?q=${encodeURIComponent(query)}`
        : "/api/recipes/public",
    ),
  getRecipeLink: (ownerId: string, recipeId: string) =>
    requestRecipe<SharedRecipe>(
      `/api/recipes/link/${encodeURIComponent(ownerId)}/${encodeURIComponent(recipeId)}`,
    ),
  copyRecipe: (ownerId: string, recipeId: string) =>
    requestRecipe<Recipe>("/api/recipes/copy", {
      body: JSON.stringify({ ownerId, recipeId }),
      method: "POST",
    }),
  listRecipeShares: (id: string) => request<RecipeShare[]>(`/api/recipes/${id}/shares`),
  shareRecipe: (id: string, identifier: string) =>
    request<RecipeShare>(`/api/recipes/${id}/shares`, {
      body: JSON.stringify({ identifier }),
      method: "POST",
    }),
  revokeRecipeShare: (id: string, userId: string) =>
    request<void>(`/api/recipes/${id}/shares/${userId}`, {
      method: "DELETE",
    }),
  importWebsite: (url: string) =>
    requestRecipe<Recipe>("/api/import/website", {
      body: JSON.stringify({ url }),
      method: "POST",
    }),
  importMarkdown: (markdown: string) =>
    requestRecipe<Recipe>("/api/import/markdown", {
      body: JSON.stringify({ markdown }),
      method: "POST",
    }),
  importStashCook: (payload: {
    baseUrl?: string;
    bearerToken?: string;
    cookie?: string;
    includeDeleted?: boolean;
    take?: number;
  }) =>
    request<ImportResult>("/api/import/stashcook", {
      body: JSON.stringify(payload),
      method: "POST",
    }).then(decodeImportResult),
  importStashCookExport: (payload: { recipes: unknown[] }) =>
    request<ImportResult>("/api/import/stashcook/export", {
      body: JSON.stringify(payload),
      method: "POST",
    }).then(decodeImportResult),
  mirrorRecipeImages: () =>
    request<MirrorImagesResult>("/api/assets/images/mirror-recipes", {
      method: "POST",
    }).then(decodeMirrorImagesResult),
  uploadImage: async (file: File, recipeId?: string): Promise<ImageAsset> => {
    const form = new FormData();
    form.append("file", file);
    if (recipeId) {
      form.append("recipeId", recipeId);
    }

    // No JSON content-type here: the browser sets the multipart boundary.
    const response = await fetch("/api/assets/images/upload", {
      body: form,
      credentials: "include",
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ImageAsset>;
  },
  importImageFromUrl: (url: string, recipeId?: string, filename?: string) =>
    request<ImageAsset>("/api/assets/images/from-url", {
      body: JSON.stringify({ url, recipeId, filename }),
      method: "POST",
    }),
  shoppingList: (recipeIds?: string[]) =>
    request<ShoppingListResult>("/api/agents/workflows/shopping-list", {
      body: JSON.stringify({ recipeIds }),
      method: "POST",
    }),
  searchRecipes: (payload: {
    q?: string;
    tag?: string;
    source?: string;
    limit?: number;
    includeIngredients?: boolean;
    includeSteps?: boolean;
  }) =>
    request<RecipeSearchResult>("/api/agents/tools/search-recipes", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  structureRecipe: (recipe: Recipe) =>
    request<RecipeStructureResult>("/api/structure/recipe", {
      body: JSON.stringify({ recipe }),
      method: "POST",
    }).then(decodeStructureResult),
  remixRecipe: (payload: RecipeRemixPayload) =>
    request<RecipeRemixApiResult>("/api/ai/recipes/remix", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  generateRecipeImage: (payload: {
    recipe: RecipeDraft;
    prompt?: string;
    size?: "1024x1024" | "1536x1024" | "1024x1536";
    steps?: number;
  }) =>
    request<GeneratedRecipeImage>("/api/ai/images/recipe", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  generateGatheringDraft: (payload: GatheringDraftPayload) =>
    request<GatheringDraftResult>("/api/gatherings/draft", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  recommendGatheringRecipes: (payload: GatheringRecipeRecommendationPayload) =>
    request<GatheringRecipeRecommendationResult>("/api/gatherings/recommend-recipes", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  generateGatheringArtifacts: (payload: GenerateGatheringArtifactsPayload) =>
    request<GenerateGatheringArtifactsResult>("/api/gatherings/artifacts", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  publishGathering: (payload: PublishGatheringPayload) =>
    request<PublishGatheringResult>("/api/gatherings", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  listGatherings: () =>
    requestWithTimeout<Gathering[]>("/api/gatherings", gatheringLoadTimeoutMs),
  createGathering: (payload: SaveGatheringPayload = {}) =>
    request<Gathering>("/api/gatherings/drafts", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  getOwnedGathering: (id: string) =>
    requestWithTimeout<Gathering>(
      `/api/gatherings/mine/${encodeURIComponent(id)}`,
      gatheringLoadTimeoutMs,
    ),
  updateGathering: (id: string, payload: SaveGatheringPayload) =>
    request<Gathering>(`/api/gatherings/mine/${encodeURIComponent(id)}`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),
  publishOwnedGathering: (id: string, payload: SaveGatheringPayload) =>
    request<PublishGatheringResult>(
      `/api/gatherings/mine/${encodeURIComponent(id)}/publish`,
      {
        body: JSON.stringify(payload),
        method: "POST",
      },
    ),
  sendGatheringInvites: (id: string, payload: SendGatheringInvitesPayload) =>
    request<SendGatheringInvitesResult>(
      `/api/gatherings/mine/${encodeURIComponent(id)}/invites`,
      {
        body: JSON.stringify(payload),
        method: "POST",
      },
    ),
  getGathering: (slug: string) =>
    requestWithTimeout<PublicGathering>(
      `/api/gatherings/${encodeURIComponent(slug)}`,
      gatheringLoadTimeoutMs,
    ),
  addGatheringResponse: (slug: string, payload: GatheringGuestResponsePayload) =>
    request<GatheringGuestResponse>(
      `/api/gatherings/${encodeURIComponent(slug)}/responses`,
      {
        body: JSON.stringify(payload),
        method: "POST",
      },
    ),
  exportAllJson: () =>
    request<{ recipes: Recipe[] }>("/api/export/recipes/json").then((result) => ({
      ...result,
      recipes: decodeRecipeList(result.recipes),
    })),
  exportAllMarkdown: () => requestText("/api/export/recipes/markdown"),
  exportRecipeMarkdown: (id: string) =>
    requestText(`/api/export/recipes/${id}/markdown`),
  billingSummary: () => request<BillingSummary>("/api/billing/me"),
  getFoodPreferences: () => request<UserFoodPreferencesLookup>("/api/me/preferences"),
  updateFoodPreferences: (preferences: FoodPreferences) =>
    request<UserFoodPreferences>("/api/me/preferences", {
      body: JSON.stringify(preferences),
      method: "PUT",
    }),
  startCheckout: (target: CheckoutTarget) =>
    request<{ url: string }>("/api/billing/checkout", {
      body: JSON.stringify({ target }),
      method: "POST",
    }),
  openBillingPortal: () =>
    request<{ url: string }>("/api/billing/portal", { method: "POST" }),
};
