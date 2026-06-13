import {
  type Recipe,
  type RecipeDraft,
  type RecipeImageGenerationInput,
  type RecipeRemixInput,
  type RecipeRemixResult,
  recipeRemixResultSchema,
} from "@open-cook/core";
import * as v from "valibot";
import type { ImageAssetStore } from "../assets/imageAssets";
import { workersAiModels } from "./workersAiModels";
import { type WorkersAiBinding, workersAiResponseObject } from "./workersAiResponses";

export type RecipeAiBinding = WorkersAiBinding;

export type RecipeAiEnvironment = {
  AI?: RecipeAiBinding;
};

export type GeneratedAiResult<T> = T & {
  provider: {
    provider: string;
    model: string;
  };
};

export type RecipeAiService = {
  remixRecipe(input: RecipeRemixInput): Promise<GeneratedAiResult<RecipeRemixResult>>;
  generateRecipeImage(input: RecipeImageGenerationInput): Promise<
    GeneratedAiResult<{
      url?: string;
      prompt: string;
      contentType: string;
      size: number;
    }>
  >;
};

type RecipeAiServiceOptions = {
  env: RecipeAiEnvironment;
  assets: ImageAssetStore;
};

const defaultImageSize = "1024x1024";
const defaultFlux2ImageSteps = 25;
const defaultLegacyImageSteps = 4;
const workersAiImageContentType = "image/jpeg";

export class RecipeAiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeAiUnavailableError";
  }
}

export class RecipeAiGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeAiGenerationError";
  }
}

export function createRecipeAiService({
  env,
  assets,
}: RecipeAiServiceOptions): RecipeAiService {
  return {
    async remixRecipe(input) {
      if (env.AI) {
        return remixRecipeWithWorkersAi(input, {
          ai: env.AI,
          model: workersAiModels.recipeRemix,
        });
      }

      throw new RecipeAiUnavailableError(
        "Recipe remixing requires the Workers AI binding.",
      );
    },
    async generateRecipeImage(input) {
      if (!env.AI) {
        throw new RecipeAiUnavailableError(
          "Recipe image generation requires the Workers AI binding.",
        );
      }

      const model = workersAiModels.recipeImage;
      const prompt = input.prompt ?? recipeImagePrompt(input.recipe);
      const result = await env.AI.run(
        model,
        await recipeImageModelInput(model, {
          prompt,
          size: input.size ?? defaultImageSize,
          steps: input.steps ?? defaultImageStepsForModel(model),
        }),
      );
      const image = await workersAiImageOutput(result);

      const asset = assets.canStore
        ? await assets.storeImageBytes(image.bytes, {
            contentType: image.contentType,
            filename: input.recipe.title,
            sourceUrl: `ai:workers-ai:${model}`,
          })
        : undefined;

      return {
        contentType: image.contentType,
        prompt,
        provider: {
          provider: "workers-ai",
          model,
        },
        size: image.bytes.byteLength,
        url: asset?.url,
      };
    },
  };
}

async function remixRecipeWithWorkersAi(
  input: RecipeRemixInput,
  options: { ai: RecipeAiBinding; model: string },
): Promise<GeneratedAiResult<RecipeRemixResult>> {
  const result = await options.ai.run(options.model, {
    max_completion_tokens: 4_500,
    messages: [
      {
        role: "system",
        content: recipeRemixSystemPrompt,
      },
      {
        role: "user",
        content: recipeRemixPrompt(input),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        description:
          "A safe, practical recipe draft adapted from the user's source recipe and remix request.",
        name: "RecipeRemix",
        schema: recipeRemixJsonSchema,
        strict: false,
      },
    },
    temperature: 0.5,
  });

  const parsed = workersAiResponseObject(result);
  const validation = v.safeParse(recipeRemixResultSchema, parsed);
  if (!validation.success) {
    throw new RecipeAiGenerationError("Workers AI returned an invalid recipe remix.");
  }

  return {
    ...cleanRemixResult(validation.output),
    provider: {
      provider: "workers-ai",
      model: options.model,
    },
  };
}

const recipeRemixSystemPrompt = [
  "You are OpenCook's recipe adaptation engine.",
  "Adapt recipes into practical, cookable drafts for the user's requested audience or theme.",
  "Preserve food safety, ingredient realism, and the source recipe's core intent unless the user explicitly asks for a substitution.",
  "Do not invent dietary guarantees. If allergies, alcohol, heat, sharp tools, or children are relevant, add concise safetyNotes.",
  "Return only data matching the requested schema. Do not include markdown.",
].join(" ");

function recipeRemixPrompt(input: RecipeRemixInput) {
  const recipe = compactRecipeForPrompt(input.recipe);
  const imagePromptRule = input.includeImagePrompt
    ? "Include an imagePrompt for a polished recipe image. It should describe the final plated food and theme, not text overlays."
    : "Omit imagePrompt.";

  return `Remix request: ${input.prompt}
Audience: ${input.audience ?? "general"}
Theme: ${input.theme ?? "none"}

${imagePromptRule}

Source recipe JSON:
${JSON.stringify(recipe, null, 2)}

Output rules:
- Return a complete draft recipe with title, tags, ingredients, steps, and notes.
- Keep ingredients and steps cookable for a real kitchen.
- For child-friendly requests, write child-facing language but keep knife, heat, and appliance work assigned to adults in the steps or safety notes.
- Keep times and servings realistic; omit unknown optional values rather than using null.
- Do not include imageUrl; image generation is handled separately.
- changes should briefly explain the meaningful differences from the source recipe.`;
}

function compactRecipeForPrompt(recipe: Recipe) {
  return {
    title: recipe.title,
    description: recipe.description,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    servings: recipe.servings,
    tags: recipe.tags,
    ingredients: recipe.ingredients.map((ingredient) => ({
      section: ingredient.section,
      text: ingredient.text,
    })),
    steps: recipe.steps.map((step) => ({
      section: step.section,
      text: step.text,
    })),
    notes: recipe.notes,
  };
}

function recipeImagePrompt(recipe: RecipeDraft) {
  return [
    `A polished appetizing photo-style image of ${recipe.title}.`,
    recipe.description,
    recipe.tags.length ? `Mood and theme: ${recipe.tags.join(", ")}.` : undefined,
    "Show the finished dish clearly with natural light, realistic ingredients, and no text or logos.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function workersAiImageOutput(result: unknown) {
  if (result instanceof Response) {
    return {
      bytes: new Uint8Array(await result.arrayBuffer()),
      contentType:
        result.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ??
        workersAiImageContentType,
    };
  }

  if (result instanceof ArrayBuffer) {
    return {
      bytes: new Uint8Array(result),
      contentType: workersAiImageContentType,
    };
  }

  if (result instanceof Uint8Array) {
    return {
      bytes: result,
      contentType: workersAiImageContentType,
    };
  }

  if (isRecord(result) && typeof result.image === "string") {
    return imageBytesFromBase64(result.image);
  }

  throw new RecipeAiGenerationError("Workers AI returned invalid image output.");
}

async function recipeImageModelInput(
  model: string,
  input: { prompt: string; size: string; steps: number },
): Promise<Record<string, unknown>> {
  if (!usesMultipartImageInput(model)) {
    return {
      prompt: input.prompt,
      steps: Math.min(input.steps, 8),
    };
  }

  const { width, height } = imageDimensions(input.size);
  const form = new FormData();
  form.append("prompt", input.prompt);
  form.append("width", String(width));
  form.append("height", String(height));
  form.append("steps", String(input.steps));

  const formResponse = new Response(form);
  const body = formResponse.body;
  const contentType = formResponse.headers.get("content-type");
  if (!body || !contentType) {
    throw new RecipeAiGenerationError("Could not prepare Workers AI image input.");
  }

  return {
    multipart: {
      body,
      contentType,
    },
  };
}

function usesMultipartImageInput(model: string) {
  return model.includes("/flux-2-");
}

function defaultImageStepsForModel(model: string) {
  return usesMultipartImageInput(model)
    ? defaultFlux2ImageSteps
    : defaultLegacyImageSteps;
}

function imageDimensions(size: string) {
  const [width, height] = size.split("x").map((value) => Number(value));
  if (!width || !height) {
    return { height: 1024, width: 1024 };
  }
  return { height, width };
}

function imageBytesFromBase64(value: string) {
  const trimmed = value.trim();
  const dataUri = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/i.exec(trimmed);
  const contentType = dataUri?.[1]?.trim().toLowerCase() ?? workersAiImageContentType;
  const base64 = dataUri?.[2] ?? trimmed;

  try {
    const binary = atob(base64);
    return {
      bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)),
      contentType,
    };
  } catch {
    throw new RecipeAiGenerationError("Workers AI returned invalid image data.");
  }
}

function cleanRemixResult(result: RecipeRemixResult): RecipeRemixResult {
  return {
    changes: uniqueCleanStrings(result.changes),
    draft: cleanDraft(result.draft),
    imagePrompt: cleanString(result.imagePrompt),
    safetyNotes: uniqueCleanStrings(result.safetyNotes),
  };
}

function cleanDraft(draft: RecipeDraft): RecipeDraft {
  return {
    ...draft,
    description: cleanString(draft.description),
    ingredients: draft.ingredients.filter((ingredient) => cleanString(ingredient.text)),
    notes: uniqueCleanStrings(draft.notes),
    servings: cleanString(draft.servings),
    steps: draft.steps.filter((step) => cleanString(step.text)),
    tags: uniqueCleanStrings(draft.tags),
    title: cleanString(draft.title) ?? "Remixed recipe",
  };
}

function uniqueCleanStrings(values: string[]) {
  return [
    ...new Set(
      values.map(cleanString).filter((value): value is string => Boolean(value)),
    ),
  ];
}

function cleanString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const textFieldJsonSchema = { type: "string", minLength: 1 };

const recipeRemixJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    draft: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: textFieldJsonSchema,
        description: { type: "string" },
        prepTimeMinutes: { type: "number", minimum: 0 },
        cookTimeMinutes: { type: "number", minimum: 0 },
        totalTimeMinutes: { type: "number", minimum: 0 },
        servings: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              section: { type: "string" },
              text: textFieldJsonSchema,
              item: { type: "string" },
              preparation: { type: "string" },
              note: { type: "string" },
            },
            required: ["text"],
          },
        },
        steps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              section: { type: "string" },
              text: textFieldJsonSchema,
            },
            required: ["text"],
          },
        },
        notes: { type: "array", items: { type: "string" } },
      },
      required: ["title", "tags", "ingredients", "steps", "notes"],
    },
    changes: { type: "array", items: { type: "string" } },
    safetyNotes: { type: "array", items: { type: "string" } },
    imagePrompt: { type: "string" },
  },
  required: ["draft", "changes", "safetyNotes"],
} as const;
