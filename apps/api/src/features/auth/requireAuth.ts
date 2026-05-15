import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../../AppContext";

export const requireAuthMiddleware = createMiddleware<Env>(async (c, next) => {
  if (!c.var.user || !c.var.session) {
    if (c.var.authSessionResolutionFailed) {
      return c.json({ error: "session_resolution_failed" }, 503);
    }
    throw new HTTPException(401);
  }

  await next();
});
