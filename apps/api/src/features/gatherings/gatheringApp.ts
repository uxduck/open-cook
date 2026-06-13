import {
  decodeRecipeText,
  type FoodPreferences,
  type Gathering,
  type GatheringArtifact,
  type GatheringArtifactKind,
  type GatheringArtifactStatus,
  gatheringSchema,
  type GatheringGuestResponse,
  gatheringGuestResponseSchema,
  type GatheringInvitee,
  type OwnedGathering,
  ownedGatheringSchema,
  type PublicGathering,
  publicGatheringSchema,
  type Recipe,
  type RecipeOwner,
  type SharedRecipe,
} from "@open-cook/core";
import { and, desc, eq, inArray } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import type { ReactElement } from "react";
import { Resend } from "resend";
import * as v from "valibot";
import type { Env } from "../../AppContext";
import { workersAiModels } from "../../ai/workersAiModels";
import { workersAiResponseObject } from "../../ai/workersAiResponses";
import {
  gatheringArtifacts,
  type GatheringArtifactRow,
  gatheringResponses,
  type GatheringResponseRow,
  type GatheringRow,
  type NewGatheringArtifactRow,
  gatherings,
  type NewGatheringResponseRow,
  type RecipeRow,
  recipes,
  user,
  userFoodPreferences as userFoodPreferencesTable,
} from "../../db/schema";
import { requireAuthMiddleware } from "../auth/requireAuth";
import { GatheringInvite } from "../emails";
import {
  compactRecipeRecommendationCandidate,
  maxAiRecipeRecommendationCandidates,
  maxRecipeRecommendationCount,
  normalizeRecipeRecommendationCount,
  recommendRecipesDeterministically,
  stripRecipeFromRecommendation,
  type RecipeRecommendation,
  type RecipeRecommendationContext,
  type RecipeRecommendationResult,
} from "./recipeRecommendations";

const gatheringDraftAiTimeoutMs = 4_000;
const gatheringRecommendationAiTimeoutMs = 4_000;
const defaultGuestQuestion = "Tell us anything we should avoid or adapt.";
const defaultCreatorDirection = "warm, simple, and easy to share";
const defaultGatheringTitle = "OpenCook gathering";
const copiedGatheringTitleSuffix = " copy";
const defaultResendFromEmail = "OpenCook <onboarding@resend.dev>";
const defaultFalImageModel = "fal-ai/flux/schnell";
const defaultFalVideoModel = "fal-ai/veo3.1/fast";
const defaultElevenLabsModel = "eleven_multilingual_v2";
const defaultElevenLabsOutputFormat = "mp3_44100_128";
const defaultElevenLabsVoiceId = "JBFqnCBsd6RMkjVDRZzb";
const generatedMediaCacheControl = "public, max-age=31536000, immutable";
const maxGeneratedAudioBytes = 8 * 1024 * 1024;
const maxGeneratedMediaBytes = 60 * 1024 * 1024;
const slugSuffixLength = 8;

const gatheringDraftRequestSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  prompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  dietary: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  guestQuestion: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(300))),
  recipeIds: v.array(v.pipe(v.string(), v.minLength(1))),
});

const recommendGatheringRecipesRequestSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  prompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  dietary: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  guestQuestion: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(300))),
  query: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
  count: v.optional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1),
      v.maxValue(maxRecipeRecommendationCount),
    ),
  ),
  candidateRecipeIds: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
});

const gatheringRecipeRecommendationSchema = v.object({
  id: v.string(),
  title: v.string(),
  score: v.number(),
  reasons: v.array(v.string()),
});

const recommendGatheringRecipesResponseSchema = v.object({
  recipeIds: v.array(v.string()),
  recommendations: v.array(gatheringRecipeRecommendationSchema),
  rejectedCount: v.number(),
  warnings: v.array(v.string()),
  provider: v.object({
    provider: v.picklist(["deterministic", "workers-ai"]),
    model: v.optional(v.string()),
  }),
});

const aiRecipeRecommendationResponseSchema = v.object({
  picks: v.array(
    v.object({
      id: v.string(),
      reason: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(180))),
    }),
  ),
  warnings: v.optional(v.array(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
});

const gatheringDraftResponseSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  welcome: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2_000)),
  guestQuestion: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
  provider: v.object({
    provider: v.picklist(["workers-ai", "template"]),
    model: v.optional(v.string()),
  }),
});

const createGatheringRequestSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  prompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  welcome: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  dietary: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  guestQuestion: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(300))),
  recipeIds: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
  inviteeEmails: v.optional(v.array(v.pipe(v.string(), v.trim(), v.email()))),
});

const updateGatheringRequestSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  prompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  welcome: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  dietary: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  guestQuestion: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(300))),
  recipeIds: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
  inviteeEmails: v.optional(v.array(v.pipe(v.string(), v.trim(), v.email()))),
});

const publishGatheringRequestSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  prompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  welcome: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2_000)),
  dietary: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  guestQuestion: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
  recipeIds: v.array(v.pipe(v.string(), v.minLength(1))),
  inviteeEmails: v.optional(v.array(v.pipe(v.string(), v.trim(), v.email()))),
});

const publishOwnedGatheringRequestSchema = updateGatheringRequestSchema;

const publishGatheringResponseSchema = v.object({
  gathering: ownedGatheringSchema,
  url: v.pipe(v.string(), v.url()),
});

const sendGatheringInvitesRequestSchema = v.object({
  inviteeEmails: v.array(v.pipe(v.string(), v.trim(), v.email())),
});

const sendGatheringInvitesResponseSchema = v.object({
  gathering: ownedGatheringSchema,
  sentCount: v.number(),
  url: v.pipe(v.string(), v.url()),
});

const gatheringListResponseSchema = v.array(gatheringSchema);

const gatheringArtifactIdSchema = v.picklist([
  "menu-images",
  "page-artwork",
  "rsvp-artwork",
  "voiceover",
  "video-teaser",
]);

const gatheringArtifactJobSchema = v.object({
  id: gatheringArtifactIdSchema,
  label: v.string(),
  provider: v.picklist(["elevenlabs", "fal"]),
  status: v.picklist(["ready", "submitted", "skipped", "failed"]),
  audioUrl: v.optional(v.string()),
  mediaUrl: v.optional(v.string()),
  contentType: v.optional(v.string()),
  size: v.optional(v.number()),
  model: v.optional(v.string()),
  requestId: v.optional(v.string()),
  voiceId: v.optional(v.string()),
  voiceName: v.optional(v.string()),
  statusUrl: v.optional(v.pipe(v.string(), v.url())),
  responseUrl: v.optional(v.pipe(v.string(), v.url())),
  cancelUrl: v.optional(v.pipe(v.string(), v.url())),
  error: v.optional(v.string()),
});

const gatheringArtifactsRequestSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  prompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  welcome: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  dietary: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  guestQuestion: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(300))),
  recipeIds: v.array(v.pipe(v.string(), v.minLength(1))),
});

const gatheringArtifactsResponseSchema = v.object({
  jobs: v.array(gatheringArtifactJobSchema),
});

const gatheringResponseRequestSchema = v.object({
  guestName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  email: v.optional(v.pipe(v.string(), v.trim(), v.email())),
  selectedRecipeIds: v.array(v.pipe(v.string(), v.minLength(1))),
  bringing: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
});

export const gatheringApp = new Hono<Env>()
  .post(
    "/recommend-recipes",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Recommend saved recipes for a gathering from current candidates, saved food preferences, and gathering context. Uses deterministic filtering and ranking with Workers AI reranking when configured.",
      responses: {
        200: {
          content: {
            "application/json": {
              schema: resolver(recommendGatheringRecipesResponseSchema),
            },
          },
          description: "Recipe recommendations returned.",
        },
        400: { description: "Invalid recommendation request." },
      },
    }),
    validator("json", recommendGatheringRecipesRequestSchema),
    async (c) => {
      const input = c.req.valid("json");
      const [preferences, candidateRecipes] = await Promise.all([
        currentUserFoodPreferences(c),
        listRecommendationCandidateRecipes(c, input),
      ]);

      return c.json(
        await recommendGatheringRecipes(c, input, preferences, candidateRecipes),
      );
    },
  )
  .post(
    "/draft",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Generate editable gathering page copy from selected recipes and the creator's note.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(gatheringDraftResponseSchema) },
          },
          description: "Editable gathering copy returned.",
        },
        400: { description: "Invalid gathering draft request." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    validator("json", gatheringDraftRequestSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const input = c.req.valid("json");
      const recipeIds = uniqueStrings(input.recipeIds);
      if (recipeIds.length === 0) {
        return c.json({ error: "Choose at least one recipe." }, 400);
      }

      const selectedRecipes = await listOwnedRecipes(c, recipeIds);
      if (selectedRecipes.length !== recipeIds.length) {
        return c.json({ error: "One or more recipes could not be found." }, 400);
      }

      return c.json(
        await generateGatheringDraft(c, {
          dietary: input.dietary,
          guestQuestion: input.guestQuestion,
          prompt: input.prompt,
          recipes: selectedRecipes,
          title: input.title,
        }),
      );
    },
  )
  .post(
    "/artifacts",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Submit creative gathering media jobs after the creator confirms the brief.",
      responses: {
        202: {
          content: {
            "application/json": { schema: resolver(gatheringArtifactsResponseSchema) },
          },
          description: "Creative artifact generation jobs were submitted.",
        },
        400: { description: "Invalid artifact generation request." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    validator("json", gatheringArtifactsRequestSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const input = c.req.valid("json");
      const recipeIds = uniqueStrings(input.recipeIds);
      if (recipeIds.length === 0) {
        return c.json({ error: "Choose at least one recipe." }, 400);
      }

      const selectedRecipes = await listOwnedRecipes(c, recipeIds);
      if (selectedRecipes.length !== recipeIds.length) {
        return c.json({ error: "One or more recipes could not be found." }, 400);
      }

      const draft = fallbackDraft({
        dietary: input.dietary,
        guestQuestion: input.guestQuestion,
        prompt: input.prompt,
        recipes: selectedRecipes,
        title: input.title,
      });

      return c.json(
        {
          jobs: await submitGatheringArtifactJobs(c, {
            dietary: input.dietary,
            guestQuestion: input.guestQuestion ?? draft.guestQuestion,
            prompt: input.prompt,
            recipes: selectedRecipes,
            title: input.title ?? draft.title,
            welcome: input.welcome ?? draft.welcome,
          }),
        },
        202,
      );
    },
  )
  .post(
    "/drafts",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Create an editable gathering draft owned by the authenticated user.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(gatheringSchema) },
          },
          description: "Gathering draft created.",
        },
        400: { description: "Invalid gathering draft." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    validator("json", createGatheringRequestSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const input = c.req.valid("json");
      const recipeIds = uniqueStrings(input.recipeIds ?? []);
      if (recipeIds.length) {
        const selectedRecipes = await listOwnedRecipes(c, recipeIds);
        if (selectedRecipes.length !== recipeIds.length) {
          return c.json({ error: "One or more recipes could not be found." }, 400);
        }
      }

      const title = input.title?.trim() ?? "";
      const now = new Date().toISOString();
      const row: GatheringRow = {
        id: crypto.randomUUID(),
        userId: c.var.user!.id,
        slug: await uniqueSlug(c, title || defaultGatheringTitle),
        title,
        prompt: input.prompt?.trim() || null,
        welcome: input.welcome?.trim() ?? "",
        dietary: input.dietary?.trim() || null,
        guestQuestion: input.guestQuestion?.trim() ?? "",
        recipeIds,
        invitees: uniqueEmails(input.inviteeEmails ?? []).map((email) => ({
          email,
        })),
        status: "draft",
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      };

      await c.var.db.insert(gatherings).values(row);
      return c.json(gatheringFromRow(row), 201);
    },
  )
  .post(
    "/",
    requireAuthMiddleware,
    describeRoute({
      description: "Publish a gathering page and return its share link.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(publishGatheringResponseSchema) },
          },
          description: "Gathering published.",
        },
        400: { description: "Invalid gathering publish request." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    validator("json", publishGatheringRequestSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const input = c.req.valid("json");
      const recipeIds = uniqueStrings(input.recipeIds);
      const inviteeEmails = uniqueEmails(input.inviteeEmails ?? []);
      if (recipeIds.length === 0) {
        return c.json({ error: "Choose at least one recipe." }, 400);
      }

      const selectedRecipes = await listOwnedRecipes(c, recipeIds);
      if (selectedRecipes.length !== recipeIds.length) {
        return c.json({ error: "One or more recipes could not be found." }, 400);
      }

      const now = new Date().toISOString();
      const slug = await uniqueSlug(c, input.title);
      const row: GatheringRow = {
        id: crypto.randomUUID(),
        userId: c.var.user!.id,
        slug,
        title: input.title,
        prompt: input.prompt || null,
        welcome: input.welcome,
        dietary: input.dietary || null,
        guestQuestion: input.guestQuestion,
        recipeIds,
        invitees: inviteeEmails.map((email) => ({ email })),
        status: "draft",
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      };
      await c.var.db.insert(gatherings).values(row);

      const url = gatheringUrl(c, slug);
      const publishedAt = new Date().toISOString();
      await c.var.db
        .update(gatherings)
        .set({
          status: "published",
          publishedAt,
          updatedAt: publishedAt,
        })
        .where(and(eq(gatherings.userId, c.var.user!.id), eq(gatherings.id, row.id)));

      await schedulePublishedGatheringArtifacts(c, {
        gatheringId: row.id,
        dietary: input.dietary,
        guestQuestion: input.guestQuestion,
        prompt: input.prompt,
        recipes: selectedRecipes,
        title: input.title,
        welcome: input.welcome,
      });

      return c.json(
        {
          gathering: await ownedGatheringFromRow(c, {
            ...row,
            status: "published",
            publishedAt,
            updatedAt: publishedAt,
          }),
          url,
        },
        201,
      );
    },
  )
  .get(
    "/",
    requireAuthMiddleware,
    describeRoute({
      description: "List gatherings created by the authenticated user.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(gatheringListResponseSchema) },
          },
          description: "Gatherings returned in most-recently-updated order.",
        },
        503: { description: "D1 storage is not configured." },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const rows = await c.var.db
        .select()
        .from(gatherings)
        .where(eq(gatherings.userId, c.var.user!.id))
        .orderBy(desc(gatherings.updatedAt));

      return c.json(rows.map(gatheringFromRow));
    },
  )
  .get(
    "/mine/:id",
    requireAuthMiddleware,
    describeRoute({
      description: "Load an editable gathering owned by the authenticated user.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(ownedGatheringSchema) },
          },
          description: "Gathering returned.",
        },
        404: { description: "Gathering not found." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const row = await getOwnedGatheringRow(c, c.req.param("id"));
      return row
        ? c.json(await ownedGatheringFromRow(c, row))
        : c.json({ error: "Not found" }, 404);
    },
  )
  .post(
    "/mine/:id/duplicate",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Duplicate an owned gathering as a fresh editable draft. Guest responses and generated artifacts stay on the original gathering.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(ownedGatheringSchema) },
          },
          description: "Gathering duplicated as a draft.",
        },
        404: { description: "Gathering not found." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const source = await getOwnedGatheringRow(c, c.req.param("id"));
      if (!source) {
        return c.json({ error: "Not found" }, 404);
      }

      const now = new Date().toISOString();
      const title = copiedGatheringTitle(source.title);
      const copy: GatheringRow = {
        id: crypto.randomUUID(),
        userId: source.userId,
        slug: await uniqueSlug(c, title),
        title,
        prompt: source.prompt,
        welcome: source.welcome,
        dietary: source.dietary,
        guestQuestion: source.guestQuestion,
        recipeIds: uniqueStrings(source.recipeIds),
        invitees: source.invitees.map((invitee) => ({ email: invitee.email })),
        status: "draft",
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      };

      await c.var.db.insert(gatherings).values(copy);
      return c.json(await ownedGatheringFromRow(c, copy), 201);
    },
  )
  .patch(
    "/mine/:id",
    requireAuthMiddleware,
    describeRoute({
      description: "Save edits to a gathering owned by the authenticated user.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(ownedGatheringSchema) },
          },
          description: "Gathering saved.",
        },
        400: { description: "Invalid gathering update." },
        404: { description: "Gathering not found." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    validator("json", updateGatheringRequestSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const row = await getOwnedGatheringRow(c, c.req.param("id"));
      if (!row) {
        return c.json({ error: "Not found" }, 404);
      }

      const update = await gatheringUpdateFromInput(c, row, c.req.valid("json"));
      if ("error" in update) {
        return c.json({ error: update.error }, 400);
      }

      await c.var.db
        .update(gatherings)
        .set(update.values)
        .where(and(eq(gatherings.userId, c.var.user!.id), eq(gatherings.id, row.id)));

      return c.json(await ownedGatheringFromRow(c, { ...row, ...update.values }));
    },
  )
  .post(
    "/mine/:id/publish",
    requireAuthMiddleware,
    describeRoute({
      description: "Publish an owned gathering draft and return its share link.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(publishGatheringResponseSchema) },
          },
          description: "Gathering published.",
        },
        400: { description: "Invalid gathering publish request." },
        404: { description: "Gathering not found." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    validator("json", publishOwnedGatheringRequestSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const row = await getOwnedGatheringRow(c, c.req.param("id"));
      if (!row) {
        return c.json({ error: "Not found" }, 404);
      }

      const update = await gatheringUpdateFromInput(c, row, c.req.valid("json"));
      if ("error" in update) {
        return c.json({ error: update.error }, 400);
      }

      const nextRow = { ...row, ...update.values };
      if (!nextRow.title.trim()) {
        return c.json({ error: "Add a title before publishing." }, 400);
      }
      if (!nextRow.welcome.trim()) {
        return c.json({ error: "Add a welcome note before publishing." }, 400);
      }
      if (!nextRow.guestQuestion.trim()) {
        return c.json({ error: "Add a guest question before publishing." }, 400);
      }
      if (nextRow.recipeIds.length === 0) {
        return c.json({ error: "Choose at least one recipe." }, 400);
      }

      const selectedRecipes = await listOwnedRecipes(c, nextRow.recipeIds);
      if (selectedRecipes.length !== nextRow.recipeIds.length) {
        return c.json({ error: "One or more recipes could not be found." }, 400);
      }

      const sentAt = new Date().toISOString();
      const urlSlug =
        row.status === "draft" ? await uniqueSlug(c, nextRow.title, row.id) : row.slug;
      const url = gatheringUrl(c, urlSlug);
      const values: Partial<GatheringRow> = {
        ...update.values,
        slug: urlSlug,
        status: "published",
        publishedAt: nextRow.publishedAt ?? sentAt,
        updatedAt: sentAt,
      };

      await c.var.db
        .update(gatherings)
        .set(values)
        .where(and(eq(gatherings.userId, c.var.user!.id), eq(gatherings.id, row.id)));

      await schedulePublishedGatheringArtifacts(c, {
        gatheringId: row.id,
        dietary: nextRow.dietary ?? undefined,
        guestQuestion: nextRow.guestQuestion,
        prompt: nextRow.prompt ?? undefined,
        recipes: selectedRecipes,
        title: nextRow.title,
        welcome: nextRow.welcome,
      });

      return c.json({
        gathering: await ownedGatheringFromRow(c, { ...nextRow, ...values }),
        url,
      });
    },
  )
  .post(
    "/mine/:id/invites",
    requireAuthMiddleware,
    describeRoute({
      description:
        "Save invitees for a published gathering and email the unsent invite links.",
      responses: {
        200: {
          content: {
            "application/json": {
              schema: resolver(sendGatheringInvitesResponseSchema),
            },
          },
          description: "Invitees saved and new invitations sent.",
        },
        400: { description: "Invalid invite request." },
        404: { description: "Gathering not found." },
        502: { description: "Invite email delivery failed." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    validator("json", sendGatheringInvitesRequestSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const row = await getOwnedGatheringRow(c, c.req.param("id"));
      if (!row) {
        return c.json({ error: "Not found" }, 404);
      }
      if (row.status !== "published") {
        return c.json(
          { error: "Publish the gathering before sending invitations." },
          400,
        );
      }

      const inviteeEmails = uniqueEmails(c.req.valid("json").inviteeEmails);
      const previousInviteesByEmail = new Map(
        row.invitees.map((invitee) => [invitee.email.toLowerCase(), invitee]),
      );
      const emailsToSend = inviteeEmails.filter(
        (email) => !previousInviteesByEmail.get(email)?.sentAt,
      );
      const url = gatheringUrl(c, row.slug);

      try {
        await sendGatheringInvites(c, {
          emails: emailsToSend,
          gatheringTitle: row.title,
          gatheringUrl: url,
          welcome: row.welcome,
        });
      } catch (error) {
        console.warn("[gathering invite] delivery failed", error);
        return c.json({ error: "Could not send gathering invitations." }, 502);
      }

      const sentAt = new Date().toISOString();
      const sentEmailSet = new Set(emailsToSend);
      const invitees = inviteeEmails.map<GatheringInvitee>((email) => ({
        email,
        sentAt:
          previousInviteesByEmail.get(email)?.sentAt ??
          (sentEmailSet.has(email) ? sentAt : undefined),
      }));
      const values: Partial<GatheringRow> = {
        invitees,
        updatedAt: sentAt,
      };

      await c.var.db
        .update(gatherings)
        .set(values)
        .where(and(eq(gatherings.userId, c.var.user!.id), eq(gatherings.id, row.id)));

      return c.json({
        gathering: await ownedGatheringFromRow(c, { ...row, ...values }),
        sentCount: emailsToSend.length,
        url,
      });
    },
  )
  .post(
    "/fal-webhook",
    describeRoute({
      description:
        "Receive fal.ai queue completion callbacks for generated gathering media.",
      responses: {
        200: { description: "Webhook accepted." },
        400: { description: "Invalid webhook payload." },
        404: { description: "No matching artifact job." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const body = await c.req.json().catch(() => undefined);
      const result = await handleFalArtifactWebhook(c, body);
      if (!result.ok) {
        return c.json({ error: result.error }, result.status);
      }
      return c.json({ ok: true });
    },
  )
  .get(
    "/:slug",
    describeRoute({
      description:
        "Resolve a published gathering page. Invitees do not need an account.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(publicGatheringSchema) },
          },
          description: "Published gathering returned.",
        },
        404: { description: "Gathering not found." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const gathering = await getPublicGathering(c, c.req.param("slug"));
      return gathering
        ? c.json(gathering)
        : c.json({ error: "Gathering not found" }, 404);
    },
  )
  .post(
    "/:slug/responses",
    describeRoute({
      description:
        "Add a guest response to a published gathering page. Invitees can choose menu recipes or add what they are bringing.",
      responses: {
        201: {
          content: {
            "application/json": { schema: resolver(gatheringGuestResponseSchema) },
          },
          description: "Guest response saved.",
        },
        400: { description: "Invalid response." },
        404: { description: "Gathering not found." },
        503: { description: "D1 storage is not configured." },
      },
    }),
    validator("json", gatheringResponseRequestSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Gatherings require the DB binding." }, 503);
      }

      const gathering = await c.var.db
        .select({ id: gatherings.id, recipeIds: gatherings.recipeIds })
        .from(gatherings)
        .where(
          and(
            eq(gatherings.slug, c.req.param("slug")),
            eq(gatherings.status, "published"),
          ),
        )
        .get();
      if (!gathering) {
        return c.json({ error: "Gathering not found" }, 404);
      }

      const input = c.req.valid("json");
      const selectedRecipeIds = uniqueStrings(input.selectedRecipeIds).filter((id) =>
        gathering.recipeIds.includes(id),
      );
      const bringing = input.bringing?.trim();
      if (selectedRecipeIds.length === 0 && !bringing) {
        return c.json({ error: "Choose a recipe or add what you are bringing." }, 400);
      }

      const response: GatheringGuestResponse = {
        id: crypto.randomUUID(),
        gatheringId: gathering.id,
        guestName: input.guestName,
        email: input.email,
        selectedRecipeIds,
        bringing: bringing || undefined,
        note: input.note?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      await c.var.db.insert(gatheringResponses).values(responseToRow(response));
      return c.json(response, 201);
    },
  );

async function listOwnedRecipes(
  c: Context<Env>,
  recipeIds: string[],
): Promise<Recipe[]> {
  if (recipeIds.length === 0) {
    return [];
  }

  const rows = await c.var
    .db!.select()
    .from(recipes)
    .where(and(eq(recipes.userId, c.var.user!.id), inArray(recipes.id, recipeIds)));
  const recipesById = new Map(rows.map((row) => [row.id, rowToRecipe(row)]));
  return recipeIds
    .map((id) => recipesById.get(id))
    .filter((recipe): recipe is Recipe => Boolean(recipe));
}

type RecommendGatheringRecipesInput = v.InferOutput<
  typeof recommendGatheringRecipesRequestSchema
>;

async function currentUserFoodPreferences(
  c: Context<Env>,
): Promise<FoodPreferences | null> {
  if (!c.var.db) {
    return null;
  }

  const row = await c.var.db
    .select({ preferences: userFoodPreferencesTable.preferences })
    .from(userFoodPreferencesTable)
    .where(eq(userFoodPreferencesTable.userId, c.var.user!.id))
    .get();
  return row?.preferences ?? null;
}

async function listRecommendationCandidateRecipes(
  c: Context<Env>,
  input: RecommendGatheringRecipesInput,
) {
  const candidateRecipeIds = uniqueStrings(input.candidateRecipeIds ?? []);
  if (candidateRecipeIds.length === 0) {
    return c.var.store.list({ q: input.query });
  }

  const recipesById = new Map(
    (await c.var.store.list()).map((recipe) => [recipe.id, recipe]),
  );
  return candidateRecipeIds
    .map((id) => recipesById.get(id))
    .filter((recipe): recipe is Recipe => Boolean(recipe));
}

async function recommendGatheringRecipes(
  c: Context<Env>,
  input: RecommendGatheringRecipesInput,
  preferences: FoodPreferences | null,
  recipes: Recipe[],
): Promise<RecipeRecommendationResult> {
  const count = normalizeRecipeRecommendationCount(input.count);
  const context = recommendationContext(input);
  const deterministic = recommendRecipesDeterministically({
    context,
    count,
    preferences,
    recipes,
  });

  if (!c.env.AI || deterministic.candidates.length === 0) {
    return stripInternalRecommendationState(deterministic);
  }

  const model = workersAiModels.gatheringRecipePicker;
  const candidates = deterministic.candidates.slice(
    0,
    maxAiRecipeRecommendationCandidates,
  );

  try {
    const result = await withTimeout(
      c.env.AI.run(model, {
        max_completion_tokens: 512,
        messages: [
          {
            role: "system",
            content:
              "You pick recipes for a cooking app. Return only JSON matching the schema. Choose only from the provided candidate ids. Respect allergies, avoided ingredients, diet pattern, dietary notes, cook time, and user preferences. Do not claim allergy safety; use cautious practical reasons.",
          },
          {
            role: "user",
            content: recipeRecommendationPrompt({
              candidates,
              context,
              count,
              preferences,
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "RecipeRecommendations",
            strict: false,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["picks"],
              properties: {
                picks: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id"],
                    properties: {
                      id: { type: "string" },
                      reason: { type: "string", maxLength: 180 },
                    },
                  },
                },
                warnings: {
                  type: "array",
                  items: { type: "string", maxLength: 200 },
                },
              },
            },
          },
        },
        temperature: 0.25,
      }),
      gatheringRecommendationAiTimeoutMs,
      "Gathering recommendation AI timed out.",
    );

    const parsed = workersAiResponseObject(result);
    const validation = v.safeParse(aiRecipeRecommendationResponseSchema, parsed);
    if (!validation.success) {
      return stripInternalRecommendationState(deterministic);
    }

    const recommendations = mergeAiRecommendations({
      aiPicks: validation.output.picks,
      count,
      deterministicRecommendations: deterministic.candidates,
    });
    if (recommendations.length === 0) {
      return stripInternalRecommendationState(deterministic);
    }

    const warnings = [
      ...deterministic.warnings,
      ...(validation.output.warnings ?? []),
    ].slice(0, 3);
    return {
      provider: { provider: "workers-ai", model },
      recipeIds: recommendations.map((recommendation) => recommendation.id),
      recommendations,
      rejectedCount: deterministic.rejectedCount,
      warnings,
    };
  } catch (error) {
    console.warn("[gathering recommendations] AI recommendation failed", error);
    return stripInternalRecommendationState(deterministic);
  }
}

function recommendationContext(
  input: RecommendGatheringRecipesInput,
): RecipeRecommendationContext {
  return {
    dietary: input.dietary,
    guestQuestion: input.guestQuestion,
    prompt: input.prompt,
    query: input.query,
    title: input.title,
  };
}

function recipeRecommendationPrompt(input: {
  candidates: Array<{
    id: string;
    title: string;
    score: number;
    reasons: string[];
    recipe: Recipe;
  }>;
  context: RecipeRecommendationContext;
  count: number;
  preferences: FoodPreferences | null;
}) {
  return `Pick ${input.count} recipes for this gathering.

Gathering context:
${JSON.stringify(input.context, null, 2)}

Saved food preferences:
${JSON.stringify(input.preferences, null, 2)}

Candidate recipes, already filtered for hard safety constraints:
${JSON.stringify(input.candidates.map(compactRecipeRecommendationCandidate), null, 2)}

Return JSON with:
- picks: up to ${input.count} objects with id and a short reason.
- warnings: optional notes about tradeoffs.

Rules:
- Use only candidate ids.
- Prefer a balanced menu over near-duplicates.
- Prefer recipes that fit saved favorites, equipment, cook-time, skill level, and gathering notes.
- Do not include recipes that conflict with allergies or avoided ingredients.`;
}

function mergeAiRecommendations(input: {
  aiPicks: Array<{ id: string; reason?: string }>;
  count: number;
  deterministicRecommendations: Array<{
    id: string;
    title: string;
    score: number;
    reasons: string[];
    recipe: Recipe;
  }>;
}): RecipeRecommendation[] {
  const byId = new Map(
    input.deterministicRecommendations.map((recommendation) => [
      recommendation.id,
      recommendation,
    ]),
  );
  const seen = new Set<string>();
  const recommendations: RecipeRecommendation[] = [];

  for (const pick of input.aiPicks) {
    const deterministic = byId.get(pick.id);
    if (!deterministic || seen.has(pick.id)) {
      continue;
    }
    seen.add(pick.id);
    recommendations.push({
      ...stripRecipeFromRecommendation(deterministic),
      reasons: [
        pick.reason?.trim() || deterministic.reasons[0] || "Recommended for this menu",
        ...deterministic.reasons,
      ]
        .filter(Boolean)
        .slice(0, 3),
    });
    if (recommendations.length >= input.count) {
      return recommendations;
    }
  }

  for (const deterministic of input.deterministicRecommendations) {
    if (seen.has(deterministic.id)) {
      continue;
    }
    seen.add(deterministic.id);
    recommendations.push(stripRecipeFromRecommendation(deterministic));
    if (recommendations.length >= input.count) {
      return recommendations;
    }
  }

  return recommendations;
}

function stripInternalRecommendationState(
  result: ReturnType<typeof recommendRecipesDeterministically>,
): RecipeRecommendationResult {
  return {
    provider: result.provider,
    recipeIds: result.recipeIds,
    recommendations: result.recommendations,
    rejectedCount: result.rejectedCount,
    warnings: result.warnings,
  };
}

async function getOwnedGatheringRow(c: Context<Env>, id: string) {
  return c.var
    .db!.select()
    .from(gatherings)
    .where(and(eq(gatherings.userId, c.var.user!.id), eq(gatherings.id, id)))
    .get();
}

type GatheringUpdateInput = v.InferOutput<typeof updateGatheringRequestSchema>;

async function gatheringUpdateFromInput(
  c: Context<Env>,
  row: GatheringRow,
  input: GatheringUpdateInput,
): Promise<{ values: Partial<GatheringRow> } | { error: string }> {
  const values: Partial<GatheringRow> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title && row.status === "published") {
      return { error: "Add a title before saving." };
    }
    values.title = title;
  }
  if (input.prompt !== undefined) {
    values.prompt = input.prompt.trim() || null;
  }
  if (input.welcome !== undefined) {
    const welcome = input.welcome.trim();
    if (!welcome && row.status === "published") {
      return { error: "Add a welcome note before saving." };
    }
    values.welcome = welcome;
  }
  if (input.dietary !== undefined) {
    values.dietary = input.dietary.trim() || null;
  }
  if (input.guestQuestion !== undefined) {
    const guestQuestion = input.guestQuestion.trim();
    if (!guestQuestion && row.status === "published") {
      return { error: "Add a guest question before saving." };
    }
    values.guestQuestion = guestQuestion;
  }
  if (input.recipeIds !== undefined) {
    const recipeIds = uniqueStrings(input.recipeIds);
    if (recipeIds.length) {
      const selectedRecipes = await listOwnedRecipes(c, recipeIds);
      if (selectedRecipes.length !== recipeIds.length) {
        return { error: "One or more recipes could not be found." };
      }
    }
    values.recipeIds = recipeIds;
  }
  if (input.inviteeEmails !== undefined) {
    const previousInviteesByEmail = new Map(
      row.invitees.map((invitee) => [invitee.email.toLowerCase(), invitee]),
    );
    values.invitees = uniqueEmails(input.inviteeEmails).map((email) => ({
      email,
      sentAt: previousInviteesByEmail.get(email)?.sentAt,
    }));
  }

  return { values };
}

async function generateGatheringDraft(
  c: Context<Env>,
  input: {
    title?: string;
    prompt?: string;
    dietary?: string;
    guestQuestion?: string;
    recipes: Recipe[];
  },
): Promise<v.InferOutput<typeof gatheringDraftResponseSchema>> {
  const fallback = fallbackDraft(input);
  if (!c.env.AI) {
    return fallback;
  }

  const model = workersAiModels.gatheringDraft;
  try {
    const result = await withTimeout(
      c.env.AI.run(model, {
        max_completion_tokens: 320,
        messages: [
          {
            role: "system",
            content:
              "You write concise guest-facing invitation copy for a cooking app. The creator note is private theme and event direction, not copy to repeat. Transform terse, whimsical, or practical themes into polished invite language that invitees can read. Return only JSON matching the schema. Do not overpromise allergy safety.",
          },
          {
            role: "user",
            content: gatheringDraftPrompt(input),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "GatheringDraft",
            strict: false,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "welcome", "guestQuestion"],
              properties: {
                title: { type: "string", maxLength: 120 },
                welcome: { type: "string", maxLength: 2_000 },
                guestQuestion: { type: "string", maxLength: 300 },
              },
            },
          },
        },
        temperature: 0.45,
      }),
      gatheringDraftAiTimeoutMs,
      "Gathering draft AI timed out.",
    );
    const parsed = workersAiResponseObject(result);
    const validation = v.safeParse(
      v.object({
        title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
        welcome: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2_000)),
        guestQuestion: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
      }),
      parsed,
    );
    if (!validation.success) {
      return fallback;
    }

    return {
      ...validation.output,
      provider: { provider: "workers-ai", model },
    };
  } catch (error) {
    console.warn("[gathering draft] AI generation failed", error);
    return fallback;
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function gatheringDraftPrompt(input: {
  title?: string;
  prompt?: string;
  dietary?: string;
  guestQuestion?: string;
  recipes: Recipe[];
}) {
  const creatorDirection = creatorThemeDirection(input.prompt);
  const recipeSummaries = input.recipes.map((recipe) => ({
    title: recipe.title,
    description: recipe.description,
    tags: recipe.tags,
    servings: recipe.servings,
  }));
  return `Private creator theme or event direction: ${
    creatorDirection || defaultCreatorDirection
  }
Draft title, if any: ${input.title || "none"}
Known dietary notes: ${input.dietary || "none"}
Guest question, if any: ${input.guestQuestion || defaultGuestQuestion}
Selected recipes:
${JSON.stringify(recipeSummaries, null, 2)}

Write:
- a short title for the shared page,
- a welcome paragraph that invitees will read on the published page,
- a practical question for guests.
Rules:
- Do not expose planning language such as "make it warm" or "creator note".
- Do not copy the creator direction verbatim unless it is already a natural event name.
- If the direction is terse, like "dragon banquet", infer a tasteful mood and write a real invitation.
- Weave selected recipes into the invitation naturally.
- If there is only one recipe, do not ask guests to choose between recipes.`;
}

function fallbackDraft(input: {
  title?: string;
  prompt?: string;
  dietary?: string;
  guestQuestion?: string;
  recipes: Recipe[];
}): v.InferOutput<typeof gatheringDraftResponseSchema> {
  const title = input.title?.trim() || fallbackTitle(input.recipes);
  const recipeList = input.recipes.map((recipe) => recipe.title).join(", ");
  const singleRecipe = input.recipes.length === 1;
  const theme = creatorThemeDirection(input.prompt);
  const welcomeParts = [
    fallbackWelcomeOpening(title, theme),
    singleRecipe
      ? `The menu is ${recipeList}.`
      : `Choose what you would like from ${recipeList}.`,
    input.dietary?.trim() ? `Known dietary notes: ${input.dietary.trim()}.` : "",
  ].filter(Boolean);

  return {
    title,
    welcome: welcomeParts.join(" "),
    guestQuestion:
      input.guestQuestion?.trim() ||
      (singleRecipe ? defaultGuestQuestion : "Which dish would you like?"),
    provider: { provider: "template" },
  };
}

function fallbackWelcomeOpening(title: string, theme?: string) {
  if (!theme) {
    return `Come settle in for ${title}.`;
  }

  return `Come settle in for ${title}, with a ${theme} mood running through the table.`;
}

function creatorThemeDirection(prompt?: string) {
  const trimmed = prompt?.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutLegacyDefault = trimmed
    .replace(/^make it warm,\s*simple,\s*and easy to share\.?\s*;?\s*/i, "")
    .trim();
  if (!withoutLegacyDefault) {
    return undefined;
  }

  return withoutLegacyDefault;
}

function fallbackTitle(recipes: Recipe[]) {
  if (recipes.length === 1) {
    return recipes[0]?.title ?? defaultGatheringTitle;
  }
  return recipes.length > 1 ? "OpenCook menu" : defaultGatheringTitle;
}

type GatheringArtifactId = v.InferOutput<typeof gatheringArtifactIdSchema>;
type GatheringArtifactJob = v.InferOutput<typeof gatheringArtifactJobSchema>;

type FalArtifactDefinition = {
  id: GatheringArtifactId;
  input?: Record<string, unknown>;
  label: string;
  missingModelMessage?: string;
  model?: string;
};

type GatheringArtifactGenerationInput = {
  title: string;
  prompt?: string;
  welcome: string;
  dietary?: string;
  guestQuestion: string;
  recipes: Recipe[];
};

type StoredMedia = {
  contentType?: string;
  mediaUrl: string;
  size?: number;
};

const publishedArtifactOrder: GatheringArtifactKind[] = [
  "page-artwork",
  "menu-images",
  "rsvp-artwork",
  "voiceover",
  "video-teaser",
];

async function schedulePublishedGatheringArtifacts(
  c: Context<Env>,
  input: GatheringArtifactGenerationInput & { gatheringId: string },
) {
  const now = new Date().toISOString();
  await upsertGatheringArtifactRows(
    c,
    publishedGatheringArtifactPlaceholders(c, input, now),
  );

  c.executionCtx.waitUntil(
    generatePublishedGatheringArtifacts(c, input).catch((error) => {
      console.warn("[gathering artifacts] background generation failed", {
        gatheringId: input.gatheringId,
        message: error instanceof Error ? error.message : String(error),
      });
    }),
  );
}

function publishedGatheringArtifactPlaceholders(
  c: Context<Env>,
  input: GatheringArtifactGenerationInput & { gatheringId: string },
  now: string,
): NewGatheringArtifactRow[] {
  const videoModel = optionalEnv(c.env.FAL_VIDEO_MODEL) ?? defaultFalVideoModel;
  const voiceProvider = optionalEnv(c.env.ELEVENLABS_API_KEY) ? "elevenlabs" : "fal";
  const voiceModel =
    voiceProvider === "elevenlabs"
      ? (optionalEnv(c.env.ELEVENLABS_MODEL_ID) ?? defaultElevenLabsModel)
      : optionalEnv(c.env.FAL_VOICE_MODEL);

  return [
    ...gatheringImageArtifactDefinitions(c, input).map((definition) =>
      gatheringArtifactRowFromJob(
        input.gatheringId,
        {
          id: definition.id,
          label: definition.label,
          provider: "fal",
          status: "submitted",
          model: definition.model,
        },
        {
          createdAt: now,
          prompt: stringField(definition.input, "prompt"),
          status: "pending",
        },
      ),
    ),
    gatheringArtifactRowFromJob(
      input.gatheringId,
      {
        id: "voiceover",
        label: "Welcome audio",
        provider: voiceProvider,
        status: "submitted",
        model: voiceModel,
      },
      {
        createdAt: now,
        prompt: gatheringVoiceoverScript(input),
        status: "pending",
      },
    ),
    gatheringArtifactRowFromJob(
      input.gatheringId,
      {
        id: "video-teaser",
        label: "Video teaser",
        provider: "fal",
        status: "submitted",
        model: videoModel,
      },
      {
        createdAt: now,
        prompt: gatheringVideoPrompt(input),
        status: "pending",
      },
    ),
  ];
}

async function generatePublishedGatheringArtifacts(
  c: Context<Env>,
  input: GatheringArtifactGenerationInput & { gatheringId: string },
) {
  const jobs = await submitPublishedGatheringArtifactJobs(c, input);
  const now = new Date().toISOString();
  await upsertGatheringArtifactRows(
    c,
    jobs.map((job) =>
      gatheringArtifactRowFromJob(input.gatheringId, job, { createdAt: now }),
    ),
  );
}

function gatheringImageArtifactDefinitions(
  c: Context<Env>,
  input: GatheringArtifactGenerationInput,
): FalArtifactDefinition[] {
  const imageModel = optionalEnv(c.env.FAL_IMAGE_MODEL) ?? defaultFalImageModel;
  const pageArtworkModel = optionalEnv(c.env.FAL_PAGE_ARTWORK_MODEL) ?? imageModel;

  return [
    {
      id: "page-artwork",
      input: {
        image_size: "landscape_16_9",
        prompt: gatheringPageArtworkPrompt(input),
      },
      label: "Hero artwork",
      model: pageArtworkModel,
    },
    {
      id: "menu-images",
      input: {
        image_size: "landscape_16_9",
        prompt: gatheringMenuImagePrompt(input),
      },
      label: "Menu artwork",
      model: imageModel,
    },
    {
      id: "rsvp-artwork",
      input: {
        image_size: "landscape_16_9",
        prompt: gatheringRsvpArtworkPrompt(input),
      },
      label: "Reply artwork",
      model: imageModel,
    },
  ];
}

async function submitPublishedGatheringArtifactJobs(
  c: Context<Env>,
  input: GatheringArtifactGenerationInput,
): Promise<GatheringArtifactJob[]> {
  const videoModel = optionalEnv(c.env.FAL_VIDEO_MODEL) ?? defaultFalVideoModel;
  const webhookUrl = gatheringFalWebhookUrl(c);

  const imageDefinitions = gatheringImageArtifactDefinitions(c, input);
  const videoDefinition: FalArtifactDefinition = {
    id: "video-teaser",
    input: {
      aspect_ratio: "16:9",
      duration: "4s",
      generate_audio: false,
      prompt: gatheringVideoPrompt(input),
      resolution: "720p",
    },
    label: "Video teaser",
    model: videoModel,
  };

  return Promise.all([
    ...imageDefinitions.map((definition) =>
      submitGatheringArtifactJob(c, definition, { webhookUrl }),
    ),
    submitWelcomeAudioJob(c, input),
    submitGatheringArtifactJob(c, videoDefinition, { webhookUrl }),
  ]);
}

async function upsertGatheringArtifactRows(
  c: Context<Env>,
  rows: NewGatheringArtifactRow[],
) {
  for (const row of rows) {
    await c.var
      .db!.insert(gatheringArtifacts)
      .values(row)
      .onConflictDoUpdate({
        target: [gatheringArtifacts.gatheringId, gatheringArtifacts.kind],
        set: {
          cancelUrl: row.cancelUrl,
          completedAt: row.completedAt,
          contentType: row.contentType,
          error: row.error,
          label: row.label,
          mediaUrl: row.mediaUrl,
          model: row.model,
          prompt: row.prompt,
          provider: row.provider,
          requestId: row.requestId,
          responseUrl: row.responseUrl,
          size: row.size,
          status: row.status,
          statusUrl: row.statusUrl,
          updatedAt: row.updatedAt,
          voiceId: row.voiceId,
          voiceName: row.voiceName,
        },
      });
  }
}

function gatheringArtifactRowFromJob(
  gatheringId: string,
  job: GatheringArtifactJob,
  options: {
    createdAt: string;
    prompt?: string;
    status?: GatheringArtifactStatus;
  },
): NewGatheringArtifactRow {
  const status = options.status ?? job.status;
  const isComplete = status === "ready" || status === "failed" || status === "skipped";
  const mediaUrl = job.mediaUrl ?? job.audioUrl;
  return {
    id: crypto.randomUUID(),
    gatheringId,
    kind: job.id,
    label: job.label,
    provider: job.provider,
    status,
    prompt: options.prompt ?? null,
    mediaUrl: mediaUrl ?? null,
    contentType: job.contentType ?? null,
    size: job.size ?? null,
    model: job.model ?? null,
    requestId: job.requestId ?? null,
    voiceId: job.voiceId ?? null,
    voiceName: job.voiceName ?? null,
    statusUrl: job.statusUrl ?? null,
    responseUrl: job.responseUrl ?? null,
    cancelUrl: job.cancelUrl ?? null,
    error: job.error ?? null,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    completedAt: isComplete ? options.createdAt : null,
  };
}

async function handleFalArtifactWebhook(
  c: Context<Env>,
  body: unknown,
): Promise<{ ok: true } | { error: string; ok: false; status: 400 | 404 | 422 }> {
  const object = objectRecord(body);
  const requestId = stringField(object, "request_id");
  if (!requestId) {
    return { ok: false, status: 400, error: "Missing fal request_id." };
  }

  const artifact = await c.var
    .db!.select()
    .from(gatheringArtifacts)
    .where(eq(gatheringArtifacts.requestId, requestId))
    .get();
  if (!artifact) {
    return { ok: false, status: 404, error: "No matching artifact job." };
  }

  const now = new Date().toISOString();
  const webhookStatus = stringField(object, "status");
  if (webhookStatus !== "OK") {
    const error =
      stringField(object, "error") ??
      falErrorMessage(objectRecord(object?.payload), 422, "fal webhook error");
    await c.var
      .db!.update(gatheringArtifacts)
      .set({
        completedAt: now,
        error: truncate(error, 500),
        status: "failed",
        updatedAt: now,
      })
      .where(eq(gatheringArtifacts.id, artifact.id));
    return { ok: true };
  }

  const media = falMediaFromPayload(object?.payload, artifact.kind);
  if (!media?.url) {
    await c.var
      .db!.update(gatheringArtifacts)
      .set({
        completedAt: now,
        error: "fal.ai webhook did not include a generated media URL.",
        status: "failed",
        updatedAt: now,
      })
      .where(eq(gatheringArtifacts.id, artifact.id));
    return { ok: false, status: 422, error: "Missing generated media URL." };
  }

  const stored = await storeGeneratedMediaFromUrl(c, {
    contentType: media.contentType,
    filename: `${artifact.kind}-${artifact.gatheringId}`,
    sourceUrl: media.url,
  });
  await c.var
    .db!.update(gatheringArtifacts)
    .set({
      completedAt: now,
      contentType: stored.contentType ?? media.contentType ?? null,
      error: null,
      mediaUrl: stored.mediaUrl,
      size: stored.size ?? media.size ?? null,
      status: "ready",
      updatedAt: now,
    })
    .where(eq(gatheringArtifacts.id, artifact.id));

  return { ok: true };
}

function falMediaFromPayload(
  payload: unknown,
  kind: GatheringArtifactKind,
): { contentType?: string; size?: number; url?: string } | undefined {
  const object = objectRecord(payload);
  if (!object) return undefined;

  if (kind === "video-teaser") {
    const video =
      objectRecord(object.video) ??
      firstObjectField(object.videos) ??
      firstObjectField(object.output);
    const videoUrl = stringField(video, "url") ?? stringField(object, "video_url");
    if (videoUrl) {
      return {
        contentType: mediaContentType(video),
        size: mediaSize(video),
        url: videoUrl,
      };
    }
  }

  const image = firstObjectField(object.images) ?? objectRecord(object.image);
  const imageUrl = stringField(image, "url") ?? stringField(object, "image_url");
  if (imageUrl) {
    return {
      contentType: mediaContentType(image),
      size: mediaSize(image),
      url: imageUrl,
    };
  }

  const audio = objectRecord(object.audio) ?? firstObjectField(object.audios);
  const audioUrl =
    stringField(audio, "url") ??
    stringField(object, "audio_url") ??
    stringField(object, "audioUrl");
  return audioUrl
    ? {
        contentType: mediaContentType(audio),
        size: mediaSize(audio),
        url: audioUrl,
      }
    : undefined;
}

function firstObjectField(value: unknown) {
  return Array.isArray(value) ? objectRecord(value[0]) : undefined;
}

function mediaContentType(object: Record<string, unknown> | undefined) {
  return (
    stringField(object, "content_type") ??
    stringField(object, "contentType") ??
    stringField(object, "mime_type") ??
    stringField(object, "mimeType")
  );
}

function mediaSize(object: Record<string, unknown> | undefined) {
  const value = object?.file_size ?? object?.size ?? object?.size_bytes;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function submitGatheringArtifactJobs(
  c: Context<Env>,
  input: {
    title: string;
    prompt?: string;
    welcome: string;
    dietary?: string;
    guestQuestion: string;
    recipes: Recipe[];
  },
): Promise<GatheringArtifactJob[]> {
  const videoModel = optionalEnv(c.env.FAL_VIDEO_MODEL) ?? defaultFalVideoModel;
  const imageDefinitions = gatheringImageArtifactDefinitions(c, input);
  const videoDefinition: FalArtifactDefinition = {
    id: "video-teaser",
    input: {
      aspect_ratio: "16:9",
      duration: "4s",
      generate_audio: false,
      prompt: gatheringVideoPrompt(input),
      resolution: "720p",
    },
    label: "Video teaser",
    model: videoModel,
  };

  const jobs = await Promise.all([
    ...imageDefinitions.map((definition) => submitGatheringArtifactJob(c, definition)),
    submitWelcomeAudioJob(c, input),
    submitGatheringArtifactJob(c, videoDefinition),
  ]);
  return jobs;
}

async function submitWelcomeAudioJob(
  c: Context<Env>,
  input: {
    title: string;
    prompt?: string;
    welcome: string;
    dietary?: string;
    guestQuestion: string;
    recipes: Recipe[];
  },
): Promise<GatheringArtifactJob> {
  if (optionalEnv(c.env.ELEVENLABS_API_KEY)) {
    return generateElevenLabsWelcomeAudio(c, input);
  }

  const voiceModel = optionalEnv(c.env.FAL_VOICE_MODEL);
  return submitGatheringArtifactJob(c, {
    id: "voiceover",
    input: {
      text: gatheringVoiceoverScript(input),
    },
    label: "Welcome audio",
    missingModelMessage:
      "Set ELEVENLABS_API_KEY or FAL_VOICE_MODEL to generate welcome audio.",
    model: voiceModel,
  });
}

async function submitGatheringArtifactJob(
  c: Context<Env>,
  definition: FalArtifactDefinition,
  options: { webhookUrl?: string } = {},
): Promise<GatheringArtifactJob> {
  if (!definition.model || !definition.input) {
    return {
      id: definition.id,
      label: definition.label,
      provider: "fal",
      status: "skipped",
      error: definition.missingModelMessage ?? "Missing fal.ai model.",
    };
  }
  if (!optionalEnv(c.env.FAL_AI_API_KEY)) {
    return {
      id: definition.id,
      label: definition.label,
      provider: "fal",
      status: "skipped",
      model: definition.model,
      error: "FAL_AI_API_KEY is not configured.",
    };
  }

  try {
    const submission = await submitFalQueueRequest(
      c,
      definition.model,
      definition.input,
      options,
    );
    return {
      id: definition.id,
      label: definition.label,
      provider: "fal",
      status: "submitted",
      model: definition.model,
      requestId: submission.requestId,
      statusUrl: submission.statusUrl,
      responseUrl: submission.responseUrl,
      cancelUrl: submission.cancelUrl,
    };
  } catch (error) {
    console.warn("[gathering artifacts] fal job submission failed", {
      artifact: definition.id,
      message: error instanceof Error ? error.message : String(error),
      model: definition.model,
    });
    return {
      id: definition.id,
      label: definition.label,
      provider: "fal",
      status: "failed",
      model: definition.model,
      error: truncate(
        error instanceof Error ? error.message : "Could not submit fal.ai job.",
        240,
      ),
    };
  }
}

async function generateElevenLabsWelcomeAudio(
  c: Context<Env>,
  input: {
    title: string;
    prompt?: string;
    welcome: string;
    dietary?: string;
    guestQuestion: string;
    recipes: Recipe[];
  },
): Promise<GatheringArtifactJob> {
  const apiKey = optionalEnv(c.env.ELEVENLABS_API_KEY);
  const model = optionalEnv(c.env.ELEVENLABS_MODEL_ID) ?? defaultElevenLabsModel;
  const outputFormat =
    optionalEnv(c.env.ELEVENLABS_OUTPUT_FORMAT) ?? defaultElevenLabsOutputFormat;

  if (!apiKey) {
    return {
      id: "voiceover",
      label: "Welcome audio",
      provider: "elevenlabs",
      status: "skipped",
      error: "ELEVENLABS_API_KEY is not configured.",
    };
  }

  const voice = await selectElevenLabsVoice(c, input);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        voice.id,
      )}?output_format=${encodeURIComponent(outputFormat)}`,
      {
        body: JSON.stringify({
          model_id: model,
          text: gatheringVoiceoverScript(input),
          voice_settings: {
            similarity_boost: 0.76,
            stability: 0.5,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(
        `ElevenLabs request failed (${response.status}): ${await boundedResponseText(
          response,
        )}`,
      );
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxGeneratedAudioBytes) {
      throw new Error("Generated audio is larger than the OpenCook preview limit.");
    }

    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg";
    const audioUrl = await storeGeneratedAudio(c, {
      bytes,
      contentType,
      filename: input.title,
    });

    return {
      id: "voiceover",
      label: "Welcome audio",
      provider: "elevenlabs",
      status: "ready",
      audioUrl,
      mediaUrl: audioUrl,
      contentType,
      model,
      requestId:
        response.headers.get("request-id") ??
        response.headers.get("x-request-id") ??
        undefined,
      size: bytes.byteLength,
      voiceId: voice.id,
      voiceName: voice.name,
    };
  } catch (error) {
    console.warn("[gathering artifacts] ElevenLabs audio generation failed", {
      message: error instanceof Error ? error.message : String(error),
      model,
      voiceId: voice.id,
    });
    return {
      id: "voiceover",
      label: "Welcome audio",
      provider: "elevenlabs",
      status: "failed",
      error: truncate(
        error instanceof Error ? error.message : "Could not generate welcome audio.",
        240,
      ),
      model,
      voiceId: voice.id,
      voiceName: voice.name,
    };
  }
}

type ElevenLabsVoice = {
  category?: string;
  description?: string;
  labels?: Record<string, unknown>;
  name?: string;
  preview_url?: string;
  sharing?: {
    category?: string;
    description?: string;
    labels?: Record<string, unknown>;
    name?: string;
  };
  voice_id?: string;
};

async function selectElevenLabsVoice(
  c: Context<Env>,
  input: {
    title: string;
    prompt?: string;
    welcome: string;
    dietary?: string;
    guestQuestion: string;
    recipes: Recipe[];
  },
): Promise<{ id: string; name?: string }> {
  const configuredVoiceId = optionalEnv(c.env.ELEVENLABS_VOICE_ID);
  if (configuredVoiceId) {
    return { id: configuredVoiceId };
  }

  const apiKey = optionalEnv(c.env.ELEVENLABS_API_KEY);
  if (!apiKey) {
    return { id: defaultElevenLabsVoiceId };
  }

  const queries = elevenLabsVoiceSearchQueries(input);
  for (const query of queries) {
    const voices = await searchElevenLabsVoices(apiKey, query).catch((error) => {
      console.warn("[gathering artifacts] ElevenLabs voice search failed", {
        message: error instanceof Error ? error.message : String(error),
        query,
      });
      return [];
    });
    const voice = pickElevenLabsVoice(voices, query);
    if (voice?.voice_id) {
      return { id: voice.voice_id, name: voice.name ?? voice.sharing?.name };
    }
  }

  return { id: defaultElevenLabsVoiceId };
}

function elevenLabsVoiceSearchQueries(input: {
  title: string;
  prompt?: string;
  welcome: string;
  dietary?: string;
  guestQuestion: string;
  recipes: Recipe[];
}) {
  const themeText = [
    input.title,
    input.prompt ?? "",
    input.welcome,
    input.dietary ?? "",
    input.guestQuestion,
    ...input.recipes.flatMap((recipe) => [
      recipe.title,
      recipe.description ?? "",
      ...(recipe.tags ?? []),
    ]),
  ]
    .join(" ")
    .toLowerCase();
  const queries = new Set<string>();

  if (/\b(kid|kids|child|children|birthday|playful|school)\b/.test(themeText)) {
    queries.add("friendly playful storyteller");
  }
  if (/\b(formal|elegant|wedding|dinner|supper|refined)\b/.test(themeText)) {
    queries.add("warm refined narrator");
  }
  if (/\b(dragon|cinematic|fantasy|story|banquet|adventure)\b/.test(themeText)) {
    queries.add("cinematic storyteller");
  }
  if (/\b(garden|lunch|brunch|picnic|spring|summer)\b/.test(themeText)) {
    queries.add("bright warm host");
  }
  if (/\b(cozy|family|comfort|home|holiday)\b/.test(themeText)) {
    queries.add("cozy friendly host");
  }

  queries.add("warm inviting host");
  queries.add("friendly narrator");
  return [...queries];
}

async function searchElevenLabsVoices(apiKey: string, query: string) {
  const url = new URL("https://api.elevenlabs.io/v2/voices");
  url.searchParams.set("page_size", "30");
  url.searchParams.set("include_total_count", "false");
  url.searchParams.set("search", query);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "xi-api-key": apiKey,
    },
  });
  if (!response.ok) {
    throw new Error(
      `ElevenLabs voice search failed (${response.status}): ${await boundedResponseText(
        response,
      )}`,
    );
  }

  const body = objectRecord(await response.json().catch(() => undefined));
  const voices = body?.voices;
  return Array.isArray(voices) ? (voices as ElevenLabsVoice[]) : [];
}

function pickElevenLabsVoice(voices: ElevenLabsVoice[], query: string) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return voices
    .filter((voice) => voice.voice_id)
    .map((voice) => ({ score: elevenLabsVoiceScore(voice, tokens), voice }))
    .sort((left, right) => right.score - left.score)[0]?.voice;
}

function elevenLabsVoiceScore(voice: ElevenLabsVoice, tokens: string[]) {
  const labels = [
    ...Object.values(voice.labels ?? {}),
    ...Object.values(voice.sharing?.labels ?? {}),
  ].join(" ");
  const text = [
    voice.name,
    voice.description,
    voice.category,
    voice.sharing?.name,
    voice.sharing?.description,
    voice.sharing?.category,
    labels,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    tokens.reduce((score, token) => score + (text.includes(token) ? 2 : 0), 0) +
    (voice.preview_url ? 1 : 0) +
    (voice.category === "premade" || voice.category === "generated" ? 1 : 0)
  );
}

function gatheringFalWebhookUrl(c: Context<Env>) {
  const base = optionalEnv(c.env.WEBSITE_URL) ?? new URL(c.req.url).origin;
  return `${base.replace(/\/+$/, "")}/api/gatherings/fal-webhook`;
}

async function submitFalQueueRequest(
  c: Context<Env>,
  model: string,
  input: Record<string, unknown>,
  options: { webhookUrl?: string } = {},
) {
  const apiKey = optionalEnv(c.env.FAL_AI_API_KEY);
  if (!apiKey) {
    throw new Error("FAL_AI_API_KEY is not configured.");
  }

  const url = new URL(`https://queue.fal.run/${model.replace(/^\/+/, "")}`);
  if (options.webhookUrl) {
    url.searchParams.set("fal_webhook", options.webhookUrl);
  }

  const response = await fetch(url, {
    body: JSON.stringify(input),
    headers: {
      Accept: "application/json",
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const text = await response.text();
  const body = parseMaybeJson(text);

  if (!response.ok) {
    throw new Error(falErrorMessage(body, response.status, response.statusText));
  }

  const object = objectRecord(body);
  const requestId = stringField(object, "request_id");
  if (!requestId) {
    throw new Error("fal.ai queue response did not include a request_id.");
  }

  return {
    cancelUrl: stringField(object, "cancel_url"),
    requestId,
    responseUrl: stringField(object, "response_url"),
    statusUrl: stringField(object, "status_url"),
  };
}

function falErrorMessage(body: unknown, status: number, statusText: string) {
  const object = objectRecord(body);
  const detail =
    stringField(object, "detail") ??
    stringField(object, "error") ??
    stringField(object, "message");
  return detail
    ? `fal.ai queue request failed (${status}): ${detail}`
    : `fal.ai queue request failed (${status} ${statusText})`;
}

function gatheringMenuImagePrompt(input: {
  title: string;
  prompt?: string;
  welcome: string;
  dietary?: string;
  recipes: Recipe[];
}) {
  return [
    `Create a polished menu-spread image for the gathering "${input.title}".`,
    "This image will sit between the invitation copy and the recipe cards, so it should feel like a designed event page asset.",
    gatheringVisualBrief(input),
    "Show a coherent table spread inspired by the selected dishes, real plating, inviting hosting energy, no readable text or logos.",
    input.dietary ? `Dietary context to respect visually: ${input.dietary}` : "",
    `Dishes: ${recipePromptList(input.recipes)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function gatheringPageArtworkPrompt(input: {
  title: string;
  prompt?: string;
  welcome: string;
  recipes: Recipe[];
}) {
  return [
    `Create a hero image for an OpenCook gathering invitation titled "${input.title}".`,
    "This is the first image invitees see. Make it artistic, event-specific, and appetizing without adding readable text.",
    gatheringVisualBrief(input),
    `Menu inspiration: ${recipePromptList(input.recipes)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function gatheringRsvpArtworkPrompt(input: {
  title: string;
  prompt?: string;
  welcome: string;
  recipes: Recipe[];
}) {
  return [
    `Create a smaller RSVP-section artwork image for the gathering "${input.title}".`,
    "This image appears beside the guest reply form. Focus on atmospheric table details: place settings, serving pieces, ingredients, candlelight or event-appropriate details. No readable text or logos.",
    gatheringVisualBrief(input),
    `Menu inspiration: ${recipePromptList(input.recipes)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function gatheringVideoPrompt(input: {
  title: string;
  prompt?: string;
  welcome: string;
  recipes: Recipe[];
}) {
  return [
    `A 4 second cinematic food invitation teaser for "${input.title}".`,
    "Camera glides over a table being set, close-ups of the featured dishes, warm human hosting energy, no text overlays.",
    gatheringVisualBrief(input),
    `Featured dishes: ${recipePromptList(input.recipes)}`,
  ].join("\n");
}

function gatheringVisualBrief(input: {
  title: string;
  prompt?: string;
  welcome: string;
}) {
  const creatorDirection = creatorThemeDirection(input.prompt);

  return [
    "Translate the user's theme or event into finished invitation imagery; do not display the prompt as text.",
    `Event title: ${input.title}`,
    `Guest-facing invite copy: ${input.welcome}`,
    `Private theme/event direction: ${creatorDirection || defaultCreatorDirection}`,
  ].join("\n");
}

function gatheringVoiceoverScript(input: {
  title: string;
  welcome: string;
  guestQuestion: string;
  recipes: Recipe[];
}) {
  const recipeNames = input.recipes.map((recipe) => recipe.title).join(", ");
  return truncate(
    `${input.title}. ${input.welcome} The menu includes ${recipeNames}. ${input.guestQuestion}`,
    900,
  );
}

function recipePromptList(recipes: Recipe[]) {
  return recipes
    .slice(0, 8)
    .map((recipe) => {
      const parts = [
        recipe.title,
        recipe.description ? `description: ${recipe.description}` : "",
        recipe.tags?.length ? `tags: ${recipe.tags.slice(0, 6).join(", ")}` : "",
      ].filter(Boolean);
      return parts.join(" - ");
    })
    .join("; ");
}

function optionalEnv(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function parseMaybeJson(text: string): unknown {
  if (!text.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringField(object: Record<string, unknown> | undefined, key: string) {
  const value = object?.[key];
  return typeof value === "string" ? value : undefined;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

async function storeGeneratedAudio(
  c: Context<Env>,
  input: {
    bytes: ArrayBuffer;
    contentType: string;
    filename: string;
  },
) {
  const normalizedContentType =
    input.contentType.split(";")[0]?.trim().toLowerCase() || "audio/mpeg";
  if (!normalizedContentType.startsWith("audio/")) {
    throw new Error("ElevenLabs did not return an audio file.");
  }

  if (!c.env.RECIPE_IMAGES) {
    return `data:${normalizedContentType};base64,${arrayBufferToBase64(input.bytes)}`;
  }

  const extension = audioExtensionFromContentType(normalizedContentType);
  const key = `${slugBase(input.filename)}-welcome-${await shortHash(
    input.bytes,
  )}.${extension}`;

  await c.env.RECIPE_IMAGES.put(key, input.bytes, {
    customMetadata: {
      sourceUrl: "elevenlabs",
    },
    httpMetadata: {
      cacheControl: generatedMediaCacheControl,
      contentType: normalizedContentType,
    },
  });

  return generatedMediaPublicUrl(c, key);
}

async function storeGeneratedMediaFromUrl(
  c: Context<Env>,
  input: {
    contentType?: string;
    filename: string;
    sourceUrl: string;
  },
): Promise<StoredMedia> {
  if (!c.env.RECIPE_IMAGES) {
    return {
      contentType: input.contentType,
      mediaUrl: input.sourceUrl,
    };
  }

  const response = await fetch(input.sourceUrl, {
    headers: {
      Accept: "image/*,video/*,audio/*,*/*;q=0.8",
      "User-Agent": "OpenCook gathering media mirror",
    },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch generated media: ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxGeneratedMediaBytes) {
    throw new Error("Generated media is larger than the OpenCook preview limit.");
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxGeneratedMediaBytes) {
    throw new Error("Generated media is larger than the OpenCook preview limit.");
  }

  const contentType =
    input.contentType?.split(";")[0]?.trim().toLowerCase() ||
    response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ||
    inferMediaContentType(input.sourceUrl) ||
    "application/octet-stream";
  if (
    !contentType.startsWith("image/") &&
    !contentType.startsWith("video/") &&
    !contentType.startsWith("audio/")
  ) {
    throw new Error(
      "Generated media URL did not return an image, video, or audio file.",
    );
  }

  const extension = mediaExtensionFromContentType(contentType);
  const key = `${slugBase(input.filename)}-${await shortHash(bytes)}.${extension}`;
  await c.env.RECIPE_IMAGES.put(key, bytes, {
    customMetadata: {
      sourceUrl: input.sourceUrl,
    },
    httpMetadata: {
      cacheControl: generatedMediaCacheControl,
      contentType,
    },
  });

  return {
    contentType,
    mediaUrl: generatedMediaPublicUrl(c, key),
    size: bytes.byteLength,
  };
}

function generatedMediaPublicUrl(c: Context<Env>, key: string) {
  const base =
    optionalEnv(c.env.GENERATED_MEDIA_PUBLIC_BASE_URL) ??
    optionalEnv(c.env.ASSETS_PUBLIC_BASE_URL) ??
    `${new URL(c.req.url).origin}/api/assets/media`;
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(key)}`;
}

function audioExtensionFromContentType(contentType: string) {
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("webm")) return "webm";
  return "audio";
}

function mediaExtensionFromContentType(contentType: string) {
  if (contentType.startsWith("audio/"))
    return audioExtensionFromContentType(contentType);
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  return "media";
}

function inferMediaContentType(url: string) {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".mp3")) return "audio/mpeg";
  if (path.endsWith(".wav")) return "audio/wav";
  return undefined;
}

async function shortHash(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function arrayBufferToBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < view.length; index += chunkSize) {
    binary += String.fromCharCode(...view.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

async function boundedResponseText(response: Response, maxLength = 2_000) {
  if (!response.body) {
    return response.statusText;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxLength) {
    const result = await reader.read();
    if (result.done) break;

    const chunk = result.value.slice(0, Math.max(0, maxLength - total));
    chunks.push(chunk);
    total += chunk.byteLength;
  }
  await reader.cancel().catch(() => undefined);

  if (chunks.length === 0) {
    return response.statusText;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes) || response.statusText;
}

async function uniqueSlug(c: Context<Env>, title: string, existingId?: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = `${slugBase(title)}-${crypto.randomUUID().slice(0, slugSuffixLength)}`;
    const existing = await c.var
      .db!.select({ id: gatherings.id })
      .from(gatherings)
      .where(eq(gatherings.slug, slug))
      .get();
    if (!existing || existing.id === existingId) {
      return slug;
    }
  }
  return `${slugBase(title)}-${Date.now().toString(36)}`;
}

function slugBase(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 52) || "gathering"
  );
}

function copiedGatheringTitle(title: string) {
  const base = title.trim() || defaultGatheringTitle;
  return `${base.slice(0, 120 - copiedGatheringTitleSuffix.length)}${copiedGatheringTitleSuffix}`;
}

async function sendGatheringInvites(
  c: Context<Env>,
  input: {
    emails: string[];
    gatheringTitle: string;
    gatheringUrl: string;
    welcome: string;
  },
) {
  if (input.emails.length === 0) {
    return;
  }

  const creatorName = c.var.user?.name || "Your host";
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) {
    for (const email of input.emails) {
      console.info(
        "[gathering invite]",
        JSON.stringify({
          email,
          subject: `${creatorName} invited you to ${input.gatheringTitle}`,
          text: `${input.welcome}\n\n${input.gatheringUrl}`,
        }),
      );
    }
    return;
  }

  const resend = new Resend(apiKey);
  for (const email of input.emails) {
    const { error } = await resend.emails.send({
      from: c.env.RESEND_FROM_EMAIL ?? defaultResendFromEmail,
      to: [email],
      subject: `${creatorName} invited you to ${input.gatheringTitle}`,
      react: GatheringInvite({
        creatorName,
        gatheringTitle: input.gatheringTitle,
        gatheringUrl: input.gatheringUrl,
        welcome: input.welcome,
      }) as ReactElement,
      text: `${input.welcome}\n\nOpen the gathering: ${input.gatheringUrl}`,
      replyTo: c.env.RESEND_REPLY_TO,
    });

    if (error) {
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }
  }
}

function gatheringUrl(c: Context<Env>, slug: string) {
  const base = c.env.WEBSITE_URL || new URL(c.req.url).origin;
  return `${base.replace(/\/$/, "")}/g/${encodeURIComponent(slug)}`;
}

async function getPublicGathering(
  c: Context<Env>,
  slug: string,
): Promise<PublicGathering | undefined> {
  const row = await c.var
    .db!.select({ gathering: gatherings, owner: ownerColumns })
    .from(gatherings)
    .innerJoin(user, eq(user.id, gatherings.userId))
    .where(and(eq(gatherings.slug, slug), eq(gatherings.status, "published")))
    .get();
  if (!row) {
    return undefined;
  }

  const recipeRows = row.gathering.recipeIds.length
    ? await c.var
        .db!.select({ recipe: recipes, owner: ownerColumns })
        .from(recipes)
        .innerJoin(user, eq(user.id, recipes.userId))
        .where(
          and(
            eq(recipes.userId, row.gathering.userId),
            inArray(recipes.id, row.gathering.recipeIds),
          ),
        )
    : [];
  const recipesById = new Map(
    recipeRows.map((recipeRow) => [
      recipeRow.recipe.id,
      {
        ...rowToRecipe(recipeRow.recipe),
        owner: toOwner(recipeRow.owner),
      } satisfies SharedRecipe,
    ]),
  );
  const responses = await c.var
    .db!.select()
    .from(gatheringResponses)
    .where(eq(gatheringResponses.gatheringId, row.gathering.id))
    .orderBy(desc(gatheringResponses.createdAt));
  const artifactRows = await c.var
    .db!.select()
    .from(gatheringArtifacts)
    .where(eq(gatheringArtifacts.gatheringId, row.gathering.id));

  return {
    ...gatheringFromRow(row.gathering),
    owner: toOwner(row.owner),
    recipes: row.gathering.recipeIds
      .map((recipeId) => recipesById.get(recipeId))
      .filter((recipe): recipe is SharedRecipe => Boolean(recipe)),
    artifacts: gatheringArtifactsFromRows(artifactRows),
    responses: responses.map(responseFromRow),
  };
}

async function ownedGatheringFromRow(
  c: Context<Env>,
  row: GatheringRow,
): Promise<OwnedGathering> {
  return {
    ...gatheringFromRow(row),
    artifacts: await listGatheringArtifacts(c, row.id),
  };
}

async function listGatheringArtifacts(
  c: Context<Env>,
  gatheringId: string,
): Promise<GatheringArtifact[]> {
  const rows = await c.var
    .db!.select()
    .from(gatheringArtifacts)
    .where(eq(gatheringArtifacts.gatheringId, gatheringId));
  return gatheringArtifactsFromRows(rows);
}

function gatheringArtifactsFromRows(rows: GatheringArtifactRow[]): GatheringArtifact[] {
  return rows
    .map(gatheringArtifactFromRow)
    .sort(
      (left, right) =>
        gatheringArtifactSortIndex(left.kind) - gatheringArtifactSortIndex(right.kind),
    );
}

function gatheringArtifactSortIndex(kind: GatheringArtifactKind) {
  const index = publishedArtifactOrder.indexOf(kind);
  return index === -1 ? publishedArtifactOrder.length : index;
}

const ownerColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  displayUsername: user.displayUsername,
};

function toOwner(row: {
  id: string;
  name: string;
  username: string | null;
  displayUsername: string | null;
}): RecipeOwner {
  return {
    id: row.id,
    name: row.name,
    username: row.displayUsername ?? row.username ?? undefined,
  };
}

function gatheringFromRow(row: GatheringRow): Gathering {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    prompt: row.prompt ?? undefined,
    welcome: row.welcome,
    dietary: row.dietary ?? undefined,
    guestQuestion: row.guestQuestion,
    recipeIds: row.recipeIds,
    invitees: row.invitees,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt ?? undefined,
  };
}

function gatheringArtifactFromRow(row: GatheringArtifactRow): GatheringArtifact {
  return {
    id: row.id,
    gatheringId: row.gatheringId,
    kind: row.kind,
    label: row.label,
    provider: row.provider,
    status: row.status,
    prompt: row.prompt ?? undefined,
    mediaUrl: row.mediaUrl ?? undefined,
    contentType: row.contentType ?? undefined,
    size: row.size ?? undefined,
    model: row.model ?? undefined,
    voiceId: undefined,
    voiceName: row.voiceName ?? undefined,
    requestId: undefined,
    statusUrl: undefined,
    responseUrl: undefined,
    cancelUrl: undefined,
    error: row.error ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? undefined,
  };
}

function rowToRecipe(row: RecipeRow): Recipe {
  return decodeRecipeText({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    images: row.images ?? undefined,
    source: row.source ?? undefined,
    prepTimeMinutes: row.prepTimeMinutes ?? undefined,
    cookTimeMinutes: row.cookTimeMinutes ?? undefined,
    totalTimeMinutes: row.totalTimeMinutes ?? undefined,
    servings: row.servings ?? undefined,
    tags: row.tags ?? [],
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    notes: row.notes ?? [],
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function responseToRow(response: GatheringGuestResponse): NewGatheringResponseRow {
  return {
    id: response.id,
    gatheringId: response.gatheringId,
    guestName: response.guestName,
    email: response.email,
    selectedRecipeIds: response.selectedRecipeIds,
    bringing: response.bringing,
    note: response.note,
    createdAt: response.createdAt,
  };
}

function responseFromRow(row: GatheringResponseRow): GatheringGuestResponse {
  return {
    id: row.id,
    gatheringId: row.gatheringId,
    guestName: row.guestName,
    email: row.email ?? undefined,
    selectedRecipeIds: row.selectedRecipeIds,
    bringing: row.bringing ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.createdAt,
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueEmails(values: string[]) {
  return uniqueStrings(values).map((email) => email.toLowerCase());
}
