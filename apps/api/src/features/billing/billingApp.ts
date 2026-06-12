import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import * as v from "valibot";
import { validator } from "hono-openapi";
import type { Env } from "../../AppContext";
import { user as userTable } from "../../db/schema";
import { requireAuthMiddleware } from "../auth/requireAuth";
import { ensureFreeMonthlyCredits } from "./entitlements";
import { createPaidBilling, type PaidBilling } from "./paidClient";

const checkoutRequestSchema = v.object({
  target: v.picklist(["pro", "credits_5", "credits_10"]),
});

const CREDITS_NOT_CONFIGURED = "Billing is not configured." as const;

function websiteOrigin(c: {
  env: Env["Bindings"];
  req: { url: string; header: (name: string) => string | undefined };
}): string {
  const configured = c.env.WEBSITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const origin = c.req.header("Origin");
  if (origin) return origin.replace(/\/$/, "");
  return new URL(c.req.url).origin;
}

function productIdForTarget(
  billing: PaidBilling,
  target: "pro" | "credits_5" | "credits_10",
): string | undefined {
  return billing.productIds[target];
}

export const billingApp = new Hono<Env>()
  .use("*", requireAuthMiddleware)
  .get(
    "/me",
    describeRoute({
      description:
        "Return the current user's billing plan and spendable credit balances from Paid.",
      responses: {
        200: { description: "Billing summary returned." },
      },
    }),
    async (c) => {
      const user = c.var.user!;
      const billing = createPaidBilling(c.env);

      if (!billing) {
        return c.json({
          plan: user.plan ?? "free",
          balances: [],
          billingEnabled: false,
        });
      }

      // Top up the free monthly allowance before reading balances so a new
      // user's first visit already shows their free credits.
      await ensureFreeMonthlyCredits(billing, c.var.db, user.id);

      let balances: Array<{ currencyKey: string; available: number; total: number }> =
        [];
      try {
        const result =
          await billing.client.customers.getCustomerCreditBalancesByExternalId({
            externalId: user.id,
          });
        balances = (result.data ?? []).map((pool) => ({
          currencyKey: pool.currencyKey,
          available: pool.available ?? 0,
          total: pool.total ?? 0,
        }));
      } catch (error) {
        console.warn("[billing] /me balances failed", user.id, error);
      }

      return c.json({ plan: user.plan ?? "free", balances, billingEnabled: true });
    },
  )
  .post(
    "/checkout",
    describeRoute({
      description:
        "Create a Paid-hosted checkout session for a plan upgrade or credit pack. Returns the hosted URL to redirect to.",
      responses: {
        200: { description: "Checkout session created." },
        503: { description: "Billing is not configured." },
      },
    }),
    validator("json", checkoutRequestSchema),
    async (c) => {
      const user = c.var.user!;
      const { target } = c.req.valid("json");
      const billing = createPaidBilling(c.env);

      if (!billing) {
        return c.json({ error: CREDITS_NOT_CONFIGURED }, 503);
      }

      const productId = productIdForTarget(billing, target);
      if (!productId) {
        return c.json({ error: `No Paid product configured for "${target}".` }, 503);
      }

      const origin = websiteOrigin(c);
      try {
        const checkout = await billing.client.checkouts.createCheckout({
          products: [{ id: productId }],
          externalCustomerId: user.id,
          successUrl: `${origin}/account?checkout=success`,
          cancelUrl: `${origin}/pricing`,
          metadata: { userId: user.id, target },
        });
        return c.json({ url: checkout.url });
      } catch (error) {
        console.error("[billing] createCheckout failed", target, error);
        return c.json({ error: "Failed to start checkout." }, 502);
      }
    },
  )
  .post(
    "/portal",
    describeRoute({
      description:
        "Create a Paid-hosted customer portal session for managing the subscription and payment methods.",
      responses: {
        200: { description: "Portal session created." },
        503: { description: "Billing is not configured." },
      },
    }),
    async (c) => {
      const user = c.var.user!;
      const billing = createPaidBilling(c.env);

      if (!billing) {
        return c.json({ error: CREDITS_NOT_CONFIGURED }, 503);
      }

      const origin = websiteOrigin(c);
      try {
        const portal = await billing.client.customerPortals.createCustomerPortal({
          externalCustomerId: user.id,
          returnUrl: `${origin}/account`,
        });
        return c.json({ url: portal.url });
      } catch (error) {
        console.error("[billing] createCustomerPortal failed", user.id, error);
        return c.json({ error: "Failed to open billing portal." }, 502);
      }
    },
  );

// --- Webhook (mounted separately in index.ts, no auth) -----------------------

/**
 * Verify a Paid webhook against `PAID_WEBHOOK_SECRET` (the org's signing
 * secret from Settings > Webhooks). Paid sends
 * `x-webhook-signature: t=<unix_ms>,s=<base64>` where `s` is the
 * HMAC-SHA256 of `<t>.<raw_body>`. Deliveries older than five minutes are
 * rejected to prevent replay. https://docs.paid.ai/documentation/billing/webhooks
 */
async function verifyPaidSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const header = headers.get("x-webhook-signature");
  if (!header) return false;

  // Split each key=value on the FIRST `=` only — the signature is base64 and
  // its trailing `=` padding must be preserved.
  const parts = new Map<string, string>();
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts.set(kv.slice(0, i).trim(), kv.slice(i + 1));
  }
  const timestamp = Number(parts.get("t"));
  const provided = parts.get("s");
  if (!timestamp || !provided) return false;
  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${rawBody}`),
    ),
  );
  const expected = btoa(String.fromCharCode(...mac));
  return timingSafeEqual(expected, provided);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type ParsedEvent = {
  name: string | undefined;
  userId: string | undefined;
  target: string | undefined;
};

/**
 * Pull the event name and our checkout metadata out of the delivery envelope:
 * `{ event, timestamp, data: { <payloadKey>: {...} } }` where the payload key
 * is `checkout` for checkout events, `payment` for payment events, etc. The
 * `{userId, target}` metadata we set at checkout is echoed on the checkout
 * object.
 */
function parseEvent(payload: unknown): ParsedEvent {
  const root = (payload ?? {}) as Record<string, unknown>;
  const name = (root.event ?? root.eventName ?? root.type) as string | undefined;
  const data = (root.data ?? {}) as Record<string, unknown>;
  const inner = (data.checkout ?? data.payment ?? data.invoice ?? data) as Record<
    string,
    unknown
  >;
  const metadata = (inner.metadata ?? {}) as Record<string, unknown>;
  return {
    name,
    userId: metadata.userId as string | undefined,
    target: metadata.target as string | undefined,
  };
}

export const billingWebhookApp = new Hono<Env>().post("/", async (c) => {
  const secret = c.env.PAID_WEBHOOK_SECRET;
  const raw = await c.req.text();

  if (secret) {
    const ok = await verifyPaidSignature(raw, c.req.raw.headers, secret);
    if (!ok) {
      console.warn("[billing] webhook signature verification failed");
      return c.json({ error: "invalid signature" }, 401);
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return c.json({ error: "invalid payload" }, 400);
  }

  const event = parseEvent(payload);
  console.info("[billing] webhook", event.name, event.userId, event.target);

  if (!c.var.db || !event.userId) {
    return c.json({ ok: true });
  }

  const completed =
    event.name === "billing-checkout-completed" ||
    event.name === "billing-payment-succeeded";
  const ended =
    event.name === "billing-checkout-expired" ||
    event.name === "billing-payment-failed";

  // Only plan upgrades flip `plan`; credit packs are provisioned by Paid itself.
  if (completed && event.target === "pro") {
    await c.var.db
      .update(userTable)
      .set({ plan: "pro" })
      .where(eq(userTable.id, event.userId));
  } else if (ended && event.target === "pro") {
    await c.var.db
      .update(userTable)
      .set({ plan: "free" })
      .where(eq(userTable.id, event.userId));
  }

  return c.json({ ok: true });
});
