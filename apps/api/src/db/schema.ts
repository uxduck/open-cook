import type {
  FoodPreferences,
  GatheringArtifactKind,
  GatheringArtifactProvider,
  GatheringArtifactStatus,
  GatheringInvitee,
  Recipe,
} from "@open-cook/core";
import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestampMsDefault = sql`(unixepoch() * 1000)`;

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Canonical form of `email` for abuse-prevention uniqueness checks. Gmail
  // dots and `+` aliases are collapsed so `user+1@gmail.com` and
  // `u.ser@gmail.com` map to the same value and cannot create separate
  // accounts. NOT NULL + UNIQUE so any signup path that bypasses
  // normalizeEmail() fails loudly instead of silently splitting identities.
  normalizedEmail: text("normalized_email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  plan: text("plan").notNull().default("free"),
  paidCustomerId: text("paid_customer_id"),
  // When the free plan's monthly credit allowance was last granted in Paid.
  // Null until the first lazy grant; see ensureFreeMonthlyCredits().
  freeCreditsGrantedAt: integer("free_credits_granted_at", {
    mode: "timestamp_ms",
  }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(timestampMsDefault),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(timestampMsDefault),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampMsDefault),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampMsDefault),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampMsDefault),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampMsDefault),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    index("account_provider_account_idx").on(table.providerId, table.accountId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampMsDefault),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampMsDefault),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = sqliteTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    transports: text("transports"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      timestampMsDefault,
    ),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_user_id_idx").on(table.userId),
    index("passkey_credential_id_idx").on(table.credentialID),
  ],
);

export const twoFactor = sqliteTable(
  "twoFactor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    index("two_factor_secret_idx").on(table.secret),
    index("two_factor_user_id_idx").on(table.userId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  passkeys: many(passkey),
  sessions: many(session),
  twoFactors: many(twoFactor),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));

export const userFoodPreferences = sqliteTable("user_food_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  preferences: text("preferences_json", { mode: "json" })
    .$type<FoodPreferences>()
    .notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    images: text("images_json", { mode: "json" }).$type<Recipe["images"]>(),
    source: text("source_json", { mode: "json" }).$type<Recipe["source"]>(),
    prepTimeMinutes: integer("prep_time_minutes"),
    cookTimeMinutes: integer("cook_time_minutes"),
    totalTimeMinutes: integer("total_time_minutes"),
    servings: text("servings"),
    visibility: text("visibility", { enum: ["private", "unlisted", "public"] })
      .notNull()
      .default("private"),
    tags: text("tags_json", { mode: "json" }).$type<string[]>().notNull(),
    ingredients: text("ingredients_json", { mode: "json" })
      .$type<Recipe["ingredients"]>()
      .notNull(),
    steps: text("steps_json", { mode: "json" }).$type<Recipe["steps"]>().notNull(),
    notes: text("notes_json", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("recipes_user_id_idx").on(table.userId),
    index("recipes_user_title_idx").on(table.userId, table.title),
    index("recipes_user_updated_at_idx").on(table.userId, table.updatedAt),
    index("recipes_visibility_idx").on(table.visibility),
  ],
);

export const recipesRelations = relations(recipes, ({ one }) => ({
  user: one(user, {
    fields: [recipes.userId],
    references: [user.id],
  }),
}));

export const recipeShares = sqliteTable(
  "recipe_shares",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id").notNull(),
    sharedWithUserId: text("shared_with_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    seenAt: text("seen_at"),
    dismissedAt: text("dismissed_at"),
    copiedRecipeId: text("copied_recipe_id"),
  },
  (table) => [
    primaryKey({
      columns: [table.ownerId, table.recipeId, table.sharedWithUserId],
    }),
    foreignKey({
      columns: [table.ownerId, table.recipeId],
      foreignColumns: [recipes.userId, recipes.id],
    }).onDelete("cascade"),
    index("recipe_shares_shared_with_idx").on(table.sharedWithUserId),
    index("recipe_shares_owner_recipe_idx").on(table.ownerId, table.recipeId),
    index("recipe_shares_inbox_idx").on(
      table.sharedWithUserId,
      table.dismissedAt,
      table.createdAt,
    ),
  ],
);

export const recipeSharesRelations = relations(recipeShares, ({ one }) => ({
  owner: one(user, {
    fields: [recipeShares.ownerId],
    references: [user.id],
  }),
  sharedWithUser: one(user, {
    fields: [recipeShares.sharedWithUserId],
    references: [user.id],
  }),
}));

export const gatherings = sqliteTable(
  "gatherings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    prompt: text("prompt"),
    welcome: text("welcome").notNull(),
    dietary: text("dietary"),
    guestQuestion: text("guest_question").notNull(),
    recipeIds: text("recipe_ids_json", { mode: "json" }).$type<string[]>().notNull(),
    invitees: text("invitees_json", { mode: "json" })
      .$type<GatheringInvitee[]>()
      .notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    publishedAt: text("published_at"),
  },
  (table) => [
    index("gatherings_user_updated_at_idx").on(table.userId, table.updatedAt),
    index("gatherings_slug_idx").on(table.slug),
    index("gatherings_status_idx").on(table.status),
  ],
);

export const gatheringResponses = sqliteTable(
  "gathering_responses",
  {
    id: text("id").primaryKey(),
    gatheringId: text("gathering_id")
      .notNull()
      .references(() => gatherings.id, { onDelete: "cascade" }),
    guestName: text("guest_name").notNull(),
    email: text("email"),
    selectedRecipeIds: text("selected_recipe_ids_json", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    bringing: text("bringing"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("gathering_responses_gathering_created_idx").on(
      table.gatheringId,
      table.createdAt,
    ),
  ],
);

export const gatheringArtifacts = sqliteTable(
  "gathering_artifacts",
  {
    id: text("id").primaryKey(),
    gatheringId: text("gathering_id")
      .notNull()
      .references(() => gatherings.id, { onDelete: "cascade" }),
    kind: text("kind").$type<GatheringArtifactKind>().notNull(),
    label: text("label").notNull(),
    provider: text("provider").$type<GatheringArtifactProvider>().notNull(),
    status: text("status").$type<GatheringArtifactStatus>().notNull(),
    prompt: text("prompt"),
    mediaUrl: text("media_url"),
    contentType: text("content_type"),
    size: integer("size"),
    model: text("model"),
    requestId: text("request_id"),
    voiceId: text("voice_id"),
    voiceName: text("voice_name"),
    statusUrl: text("status_url"),
    responseUrl: text("response_url"),
    cancelUrl: text("cancel_url"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("gathering_artifacts_gathering_kind_unique").on(
      table.gatheringId,
      table.kind,
    ),
    index("gathering_artifacts_gathering_idx").on(table.gatheringId),
    index("gathering_artifacts_request_idx").on(table.requestId),
    index("gathering_artifacts_status_idx").on(table.status),
  ],
);

export const gatheringsRelations = relations(gatherings, ({ many, one }) => ({
  owner: one(user, {
    fields: [gatherings.userId],
    references: [user.id],
  }),
  artifacts: many(gatheringArtifacts),
  responses: many(gatheringResponses),
}));

export const gatheringArtifactsRelations = relations(gatheringArtifacts, ({ one }) => ({
  gathering: one(gatherings, {
    fields: [gatheringArtifacts.gatheringId],
    references: [gatherings.id],
  }),
}));

export const gatheringResponsesRelations = relations(gatheringResponses, ({ one }) => ({
  gathering: one(gatherings, {
    fields: [gatheringResponses.gatheringId],
    references: [gatherings.id],
  }),
}));

export const recipeCookProgress = sqliteTable(
  "recipe_cook_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipeUserId: text("recipe_user_id").notNull(),
    recipeId: text("recipe_id").notNull(),
    checkedIngredientIds: text("checked_ingredient_ids_json", {
      mode: "json",
    })
      .$type<string[]>()
      .notNull(),
    checkedStepIds: text("checked_step_ids_json", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeUserId, table.recipeId] }),
    foreignKey({
      columns: [table.recipeUserId, table.recipeId],
      foreignColumns: [recipes.userId, recipes.id],
    }).onDelete("cascade"),
    index("recipe_cook_progress_user_idx").on(table.userId, table.updatedAt),
    index("recipe_cook_progress_recipe_idx").on(table.recipeUserId, table.recipeId),
  ],
);

export const stashcookRawExports = sqliteTable(
  "stashcook_raw_exports",
  {
    key: text("key").primaryKey(),
    payloadJson: text("payload_json").notNull(),
    sourcePath: text("source_path").notNull(),
    importedAt: text("imported_at").notNull(),
  },
  (table) => [index("stashcook_raw_exports_imported_at_idx").on(table.importedAt)],
);

export type RecipeRow = typeof recipes.$inferSelect;
export type NewRecipeRow = typeof recipes.$inferInsert;
export type RecipeCookProgressRow = typeof recipeCookProgress.$inferSelect;
export type UserFoodPreferencesRow = typeof userFoodPreferences.$inferSelect;
export type GatheringRow = typeof gatherings.$inferSelect;
export type NewGatheringRow = typeof gatherings.$inferInsert;
export type GatheringArtifactRow = typeof gatheringArtifacts.$inferSelect;
export type NewGatheringArtifactRow = typeof gatheringArtifacts.$inferInsert;
export type GatheringResponseRow = typeof gatheringResponses.$inferSelect;
export type NewGatheringResponseRow = typeof gatheringResponses.$inferInsert;
