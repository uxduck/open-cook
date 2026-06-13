import { recipeOwnerSchema, sharedRecipeSchema } from "./recipe";
import * as v from "valibot";

export const gatheringStatusSchema = v.picklist(["draft", "published"]);

export const gatheringArtifactKindSchema = v.picklist([
  "menu-images",
  "page-artwork",
  "rsvp-artwork",
  "voiceover",
  "video-teaser",
]);

export const gatheringArtifactProviderSchema = v.picklist(["elevenlabs", "fal"]);

export const gatheringArtifactStatusSchema = v.picklist([
  "pending",
  "submitted",
  "ready",
  "skipped",
  "failed",
]);

export const gatheringInviteeSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  sentAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export const gatheringArtifactSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  gatheringId: v.pipe(v.string(), v.minLength(1)),
  kind: gatheringArtifactKindSchema,
  label: v.pipe(v.string(), v.minLength(1)),
  provider: gatheringArtifactProviderSchema,
  status: gatheringArtifactStatusSchema,
  prompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(4_000))),
  mediaUrl: v.optional(v.pipe(v.string(), v.minLength(1))),
  contentType: v.optional(v.pipe(v.string(), v.minLength(1))),
  size: v.optional(v.number()),
  model: v.optional(v.pipe(v.string(), v.minLength(1))),
  requestId: v.optional(v.pipe(v.string(), v.minLength(1))),
  voiceId: v.optional(v.pipe(v.string(), v.minLength(1))),
  voiceName: v.optional(v.pipe(v.string(), v.minLength(1))),
  statusUrl: v.optional(v.pipe(v.string(), v.url())),
  responseUrl: v.optional(v.pipe(v.string(), v.url())),
  cancelUrl: v.optional(v.pipe(v.string(), v.url())),
  error: v.optional(v.pipe(v.string(), v.maxLength(500))),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
  completedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export const gatheringGuestResponseSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  gatheringId: v.pipe(v.string(), v.minLength(1)),
  guestName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  email: v.optional(v.pipe(v.string(), v.email())),
  selectedRecipeIds: v.array(v.pipe(v.string(), v.minLength(1))),
  bringing: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const gatheringSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  slug: v.pipe(v.string(), v.minLength(1)),
  title: v.pipe(v.string(), v.trim(), v.maxLength(120)),
  prompt: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2_000))),
  welcome: v.pipe(v.string(), v.trim(), v.maxLength(2_000)),
  dietary: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  guestQuestion: v.pipe(v.string(), v.trim(), v.maxLength(300)),
  recipeIds: v.array(v.pipe(v.string(), v.minLength(1))),
  invitees: v.array(gatheringInviteeSchema),
  status: gatheringStatusSchema,
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
  publishedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export const publicGatheringSchema = v.object({
  ...gatheringSchema.entries,
  owner: recipeOwnerSchema,
  recipes: v.array(sharedRecipeSchema),
  artifacts: v.array(gatheringArtifactSchema),
  responses: v.array(gatheringGuestResponseSchema),
});

export const ownedGatheringSchema = v.object({
  ...gatheringSchema.entries,
  artifacts: v.array(gatheringArtifactSchema),
});

export type GatheringStatus = v.InferOutput<typeof gatheringStatusSchema>;
export type GatheringArtifactKind = v.InferOutput<typeof gatheringArtifactKindSchema>;
export type GatheringArtifactProvider = v.InferOutput<
  typeof gatheringArtifactProviderSchema
>;
export type GatheringArtifactStatus = v.InferOutput<
  typeof gatheringArtifactStatusSchema
>;
export type GatheringArtifact = v.InferOutput<typeof gatheringArtifactSchema>;
export type GatheringInvitee = v.InferOutput<typeof gatheringInviteeSchema>;
export type GatheringGuestResponse = v.InferOutput<typeof gatheringGuestResponseSchema>;
export type Gathering = v.InferOutput<typeof gatheringSchema>;
export type PublicGathering = v.InferOutput<typeof publicGatheringSchema>;
export type OwnedGathering = v.InferOutput<typeof ownedGatheringSchema>;
