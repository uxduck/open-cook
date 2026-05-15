import { swaggerUI } from "@hono/swagger-ui";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi";
import * as v from "valibot";
import type { Env } from "./AppContext";
import { appDescription, appName, appVersion } from "./AppMetadata";
import { agentApp } from "./features/agents/agentApp";
import { assetsApp } from "./features/assets/assetsApp";
import { trustedOriginsFor } from "./features/auth/auth";
import { authMiddleware } from "./features/auth/middleware";
import { exportApp } from "./features/export/exportApp";
import { importApp } from "./features/import/importApp";
import { recipeApp } from "./features/recipes/recipeApp";
import { storeMiddleware } from "./storage/storeMiddleware";

const openapiPath = "/openapi.json";

const healthResponseSchema = v.object({
  status: v.literal("ok"),
  name: v.string(),
  version: v.string(),
});

const infoResponseSchema = v.object({
  product: v.string(),
  description: v.string(),
  version: v.string(),
  apiBasePath: v.string(),
  docsPath: v.string(),
  scalarPath: v.string(),
  openapiPath: v.string(),
  storage: v.object({
    adapter: v.string(),
    replaceable: v.boolean(),
  }),
  auth: v.object({
    adapter: v.string(),
    methods: v.array(v.string()),
  }),
  imageAssets: v.object({
    adapter: v.string(),
    publicBaseUrl: v.string(),
    publicRoute: v.string(),
  }),
});

const apiApp = new Hono<Env>()
  .all("/auth/*", async (c) => {
    if (!c.var.auth) {
      return c.json({ error: "Authentication requires the DB binding." }, 503);
    }
    return c.var.auth.handler(c.req.raw);
  })
  .get(
    "/me",
    describeRoute({
      description: "Return the current Better Auth session.",
      responses: {
        200: { description: "Authenticated user returned." },
        401: { description: "No active session." },
        503: { description: "Session lookup failed." },
      },
    }),
    (c) => {
      if (!c.var.user || !c.var.session) {
        if (c.var.authSessionResolutionFailed) {
          return c.json({ error: "session_resolution_failed" }, 503);
        }
        return c.json({ error: "Unauthorized" }, 401);
      }

      return c.json({
        user: c.var.user,
        session: {
          id: c.var.session.id,
          userId: c.var.session.userId,
          expiresAt: c.var.session.expiresAt,
        },
      });
    },
  )
  .get(
    "/health",
    describeRoute({
      description: "Health check for OpenCook.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(healthResponseSchema) },
          },
          description: "API is healthy.",
        },
      },
    }),
    (c) =>
      c.json({
        status: "ok",
        name: appName,
        version: appVersion,
      }),
  )
  .get(
    "/info",
    describeRoute({
      description: "Service metadata and data ownership posture.",
      responses: {
        200: {
          content: {
            "application/json": { schema: resolver(infoResponseSchema) },
          },
          description: "Service metadata returned.",
        },
      },
    }),
    (c) =>
      c.json({
        product: appName,
        description: appDescription,
        version: appVersion,
        apiBasePath: "/api",
        docsPath: "/docs",
        scalarPath: "/scalar",
        openapiPath,
        storage: {
          adapter: c.env.DB ? "d1-drizzle" : "memory",
          replaceable: true,
        },
        auth: {
          adapter: c.var.auth ? "better-auth-d1" : "disabled",
          methods: [
            "email-password",
            "email-otp",
            "magic-link",
            "username-password",
            "two-factor-totp",
            "two-factor-email-otp",
            "passkey",
            "bearer",
          ],
        },
        imageAssets: {
          adapter: c.var.assets.canStore ? "cloudflare-r2" : "disabled",
          publicBaseUrl: c.var.assets.publicUrlForKey("").replace(/\/$/, ""),
          publicRoute: "/api/assets/images/:key",
        },
      }),
  )
  .route("/agents", agentApp)
  .route("/assets", assetsApp)
  .route("/recipes", recipeApp)
  .route("/import", importApp)
  .route("/export", exportApp);

const app = new Hono<Env>()
  .use(
    "*",
    cors({
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      exposeHeaders: ["set-auth-token"],
      origin: (origin, c) => {
        if (!origin) return null;
        return trustedOriginsFor(c.env, c.req.url).includes(origin) ? origin : null;
      },
    }),
  )
  .use("*", authMiddleware)
  .use("*", storeMiddleware)
  .route("/api", apiApp)
  .get("/docs", swaggerUI({ url: openapiPath }))
  .get("/scalar", Scalar({ url: openapiPath }));

app.get(
  openapiPath,
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        description: appDescription,
        title: appName,
        version: appVersion,
      },
      servers: [{ description: "Local development", url: "http://localhost:8787" }],
    },
  }),
);

app.get("/", (c) => {
  return c.json({
    message: "OpenCook API is running.",
    apiBasePath: "/api",
    docsPath: "/docs",
    scalarPath: "/scalar",
    openapiPath,
  });
});

export default app;
export type AppType = typeof app;
