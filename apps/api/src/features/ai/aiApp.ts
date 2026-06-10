import {
  generatedRecipeImageSchema,
  recipeAiAudienceSchema,
  recipeAiPromptSchema,
  recipeAiProviderMetadataSchema,
  recipeDraftSchema,
  recipeImageGenerationInputSchema,
  recipeSchema,
} from "@open-cook/core";
import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import {
  createDeepgramToken,
  DeepgramRequestError,
  DeepgramUnavailableError,
} from "../../ai/deepgram";
import {
  createRecipeAiService,
  RecipeAiGenerationError,
  RecipeAiUnavailableError,
} from "../../ai/recipeAiService";
import { requireAuthMiddleware } from "../auth/requireAuth";
import { assertRestyleAllowed, BillingLimitError } from "../billing/entitlements";
import { createPaidBilling, sendUsageSignal } from "../billing/paidClient";

const recipeRemixRequestSchema = v.object({
  recipeId: v.optional(v.pipe(v.string(), v.minLength(1))),
  recipe: v.optional(recipeSchema),
  prompt: recipeAiPromptSchema,
  audience: v.optional(recipeAiAudienceSchema),
  theme: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  includeImagePrompt: v.optional(v.boolean()),
});

const voiceTokenResponseSchema = v.object({
  token: v.string(),
  expiresInSeconds: v.number(),
});

const recipeRemixResponseSchema = v.object({
  draft: recipeDraftSchema,
  changes: v.array(v.pipe(v.string(), v.trim())),
  safetyNotes: v.array(v.pipe(v.string(), v.trim())),
  imagePrompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  provider: recipeAiProviderMetadataSchema,
});

export const aiApp = new Hono<Env>()
  .use("*", requireAuthMiddleware)
  .post(
    "/recipes/remix",
    describeRoute({
      description:
        "Generate a recipe draft remix from a stored recipe id or explicit recipe payload through the API Worker's Cloudflare Workers AI binding.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(recipeRemixResponseSchema) },
          },
          description: "Recipe remix draft generated.",
        },
        400: { description: "Invalid remix request." },
        404: { description: "Recipe not found." },
        502: { description: "Workers AI failed." },
        503: { description: "Workers AI is not configured." },
      },
    }),
    validator("json", recipeRemixRequestSchema),
    async (c) => {
      const input = c.req.valid("json");
      const recipe = input.recipe ?? (await recipeFromId(c, input.recipeId));

      if (!recipe) {
        return c.json(
          {
            error: input.recipeId
              ? "Recipe not found"
              : "recipeId or recipe is required",
          },
          input.recipeId ? 404 : 400,
        );
      }

      // A recipe restyle is a metered feature (free: 3/mo, Pro: 20/mo, plus
      // credit-pack overage. All tracked in Paid). Every remix counts as one.
      const billing = createPaidBilling(c.env);
      try {
        await assertRestyleAllowed(billing, c.var.user!.id);
      } catch (error) {
        if (error instanceof BillingLimitError) {
          return c.json(
            {
              error: "You're out of restyle credits. Upgrade or top up to continue.",
              reason: error.reason,
            },
            402,
          );
        }
        throw error;
      }

      try {
        const service = createRecipeAiService({ assets: c.var.assets, env: c.env });
        const remix = await service.remixRecipe({
          audience: input.audience,
          includeImagePrompt: input.includeImagePrompt,
          prompt: input.prompt,
          recipe,
          theme: input.theme,
        });
        if (billing) {
          c.executionCtx.waitUntil(
            sendUsageSignal(billing, {
              eventName: "restyle_generated",
              externalCustomerId: c.var.user!.id,
              idempotencyKey: crypto.randomUUID(),
            }),
          );
        }
        return c.json(remix);
      } catch (error) {
        return aiErrorResponse(
          c,
          error,
          "Workers AI failed to generate a recipe remix.",
        );
      }
    },
  )
  .post(
    "/images/recipe",
    describeRoute({
      description:
        "Generate and store an image for a recipe draft. The API Worker calls Cloudflare Workers AI and stores bytes in R2; raw provider access is never sent to the browser.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(generatedRecipeImageSchema) },
          },
          description: "Recipe image generated and stored.",
        },
        400: { description: "Invalid image request." },
        502: { description: "Workers AI failed." },
        503: { description: "Image generation or R2 storage is not configured." },
      },
    }),
    validator("json", recipeImageGenerationInputSchema),
    async (c) => {
      if (!c.var.assets.canStore) {
        return c.json({ error: "R2 image storage is not configured." }, 503);
      }

      try {
        const service = createRecipeAiService({ assets: c.var.assets, env: c.env });
        const image = await service.generateRecipeImage(c.req.valid("json"));
        return c.json(image, 201);
      } catch (error) {
        return aiErrorResponse(
          c,
          error,
          "Workers AI failed to generate a recipe image.",
        );
      }
    },
  )
  .post(
    "/voice/token",
    describeRoute({
      description:
        "Mint a short-lived Deepgram key so the browser can stream dictation audio directly to Deepgram. The project API key never leaves the Worker.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(voiceTokenResponseSchema) },
          },
          description: "Temporary Deepgram key issued.",
        },
        502: { description: "Deepgram key request failed." },
        503: { description: "Deepgram voice is not configured." },
      },
    }),
    async (c) => {
      try {
        const token = await createDeepgramToken(c.env);
        return c.json(token);
      } catch (error) {
        if (error instanceof DeepgramUnavailableError) {
          return c.json({ error: error.message }, 503);
        }
        if (error instanceof DeepgramRequestError) {
          return c.json({ error: error.message }, 502);
        }
        return c.json({ error: "Could not start voice dictation." }, 502);
      }
    },
  );

async function recipeFromId(c: Context<Env>, recipeId: string | undefined) {
  return recipeId ? c.var.store.get(recipeId) : undefined;
}

function aiErrorResponse(c: Context<Env>, error: unknown, fallbackMessage: string) {
  if (error instanceof RecipeAiUnavailableError) {
    return c.json({ error: error.message }, 503);
  }

  if (error instanceof RecipeAiGenerationError) {
    return c.json({ error: error.message }, 502);
  }

  return c.json(
    {
      error: fallbackMessage,
    },
    502,
  );
}
