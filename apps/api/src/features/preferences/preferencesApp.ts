import {
  foodPreferencesSchema,
  nowIso,
  userFoodPreferencesLookupSchema,
  userFoodPreferencesSchema,
} from "@open-cook/core";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import type { Env } from "../../AppContext";
import { userFoodPreferences as userFoodPreferencesTable } from "../../db/schema";
import { requireAuthMiddleware } from "../auth/requireAuth";

export const preferencesApp = new Hono<Env>()
  .use("*", requireAuthMiddleware)
  .get(
    "/",
    describeRoute({
      description: "Return the current user's saved food preferences.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(userFoodPreferencesLookupSchema) },
          },
          description: "Food preferences returned.",
        },
        401: { description: "No active session." },
        503: { description: "Preferences storage is unavailable." },
      },
    }),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Preferences storage is unavailable." }, 503);
      }

      const row = await c.var.db
        .select({
          preferences: userFoodPreferencesTable.preferences,
          updatedAt: userFoodPreferencesTable.updatedAt,
        })
        .from(userFoodPreferencesTable)
        .where(eq(userFoodPreferencesTable.userId, c.var.user!.id))
        .get();

      return c.json(
        row
          ? { preferences: row.preferences, updatedAt: row.updatedAt }
          : { preferences: null },
      );
    },
  )
  .put(
    "/",
    describeRoute({
      description: "Create or update the current user's food preferences.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(userFoodPreferencesSchema) },
          },
          description: "Food preferences saved.",
        },
        400: { description: "Invalid preference payload." },
        401: { description: "No active session." },
        503: { description: "Preferences storage is unavailable." },
      },
    }),
    validator("json", foodPreferencesSchema),
    async (c) => {
      if (!c.var.db) {
        return c.json({ error: "Preferences storage is unavailable." }, 503);
      }

      const preferences = c.req.valid("json");
      const timestamp = nowIso();
      const userId = c.var.user!.id;

      await c.var.db
        .insert(userFoodPreferencesTable)
        .values({
          createdAt: timestamp,
          preferences,
          updatedAt: timestamp,
          userId,
        })
        .onConflictDoUpdate({
          target: userFoodPreferencesTable.userId,
          set: {
            preferences,
            updatedAt: timestamp,
          },
        });

      return c.json({ preferences, updatedAt: timestamp });
    },
  );
