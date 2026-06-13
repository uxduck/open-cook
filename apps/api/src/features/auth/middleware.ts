import { createMiddleware } from "hono/factory";
import type { Env } from "../../AppContext";
import { createD1Database } from "../../db/db";
import {
  isCodexConnectionToken,
  resolveCodexConnectionToken,
} from "../agents/codexTokens";
import { createAuth } from "./auth";

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  if (!c.env.DB) {
    c.set("db", null);
    c.set("auth", null);
    c.set("user", null);
    c.set("session", null);
    c.set("authSessionResolutionFailed", false);
    await next();
    return;
  }

  const db = createD1Database(c.env.DB);
  const auth = createAuth({
    db,
    env: c.env,
    executionCtx: c.executionCtx,
    requestOrigin: c.req.header("Origin"),
    requestUrl: c.req.url,
  });

  c.set("db", db);
  c.set("auth", auth);
  c.set("user", null);
  c.set("session", null);
  c.set("authSessionResolutionFailed", false);

  if (c.req.path.startsWith("/api/auth/")) {
    await next();
    return;
  }

  const hasCredentials =
    c.req.header("Authorization")?.startsWith("Bearer ") ||
    Boolean(c.req.header("Cookie"));

  if (!hasCredentials) {
    await next();
    return;
  }

  const bearerToken = tokenFromAuthorization(c.req.header("Authorization"));
  if (bearerToken && isCodexConnectionToken(bearerToken)) {
    try {
      const authSession = await resolveCodexConnectionToken(db, bearerToken);
      if (authSession) {
        c.set("user", authSession.user);
        c.set("session", authSession.session);
      }
    } catch (error) {
      console.error("[auth] Codex connection token resolution failed", error);
      c.set("authSessionResolutionFailed", true);
    }

    await next();
    return;
  }

  try {
    const shouldBypassCookieCache = c.req.path === "/api/me";
    const authSession = await auth.api.getSession({
      headers: c.req.raw.headers,
      query: shouldBypassCookieCache ? { disableCookieCache: true } : undefined,
    });

    if (authSession) {
      c.set("user", authSession.user);
      c.set("session", authSession.session);
    }
  } catch (error) {
    console.error("[auth] session resolution failed", error);
    c.set("authSessionResolutionFailed", true);
  }

  await next();
});

function tokenFromAuthorization(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length).trim() || undefined;
}
