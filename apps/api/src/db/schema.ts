import type { Recipe } from "@open-cook/core";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestampMsDefault = sql`(unixepoch() * 1000)`;

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
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

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    source: text("source_json", { mode: "json" }).$type<Recipe["source"]>(),
    prepTimeMinutes: integer("prep_time_minutes"),
    cookTimeMinutes: integer("cook_time_minutes"),
    totalTimeMinutes: integer("total_time_minutes"),
    servings: text("servings"),
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
    index("recipes_title_idx").on(table.title),
    index("recipes_updated_at_idx").on(table.updatedAt),
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
