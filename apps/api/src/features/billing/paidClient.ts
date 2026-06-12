import { PaidClient } from "@paid-ai/paid-node";

// IMPORTANT: only import the REST `PaidClient` here. The `@paid-ai/paid-node/tracing`
// subpath pulls in Node/OpenTelemetry and only wraps the OpenAI/Anthropic SDKs, which
// OpenCook does not use (our AI runs on the Cloudflare Workers AI binding). All Paid
// interactions go through the fetch-based REST client below, which runs on Workers.

/** The subset of env vars the billing layer reads. Satisfied by both the
 * Worker `Env["Bindings"]` and the auth `AuthEnv`. */
export type PaidConfigEnv = {
  PAID_API_KEY?: string;
  PAID_PRODUCT_EXTERNAL_ID?: string;
  PAID_PRODUCT_PRO_ID?: string;
  PAID_PRODUCT_CREDITS_5_ID?: string;
  PAID_PRODUCT_CREDITS_10_ID?: string;
};

// The v2 REST API exposes endpoints (credit grants) that @paid-ai/paid-node
// does not wrap yet; those are called directly with the same API key.
const PAID_API_BASE = "https://api.agentpaid.io/api/v2";

/** Key of the org's credit currency, created by scripts/paid-setup-pricing.mjs.
 * The same key exists in both the prod and test Paid orgs. */
export const CREDIT_CURRENCY_KEY = "opencook_credits";

export type PaidBilling = {
  client: PaidClient;
  apiKey: string;
  productExternalId: string | undefined;
  productIds: {
    pro: string | undefined;
    credits_5: string | undefined;
    credits_10: string | undefined;
  };
};

/**
 * Build a Paid billing context from the environment. Returns `null` when no
 * `PAID_API_KEY` is configured (e.g. local dev without billing, or the
 * DB-less memory store) so feature gating degrades to "allowed" rather than
 * blocking everything.
 */
export function createPaidBilling(env: PaidConfigEnv): PaidBilling | null {
  if (!env.PAID_API_KEY) {
    return null;
  }

  return {
    client: new PaidClient({ token: env.PAID_API_KEY }),
    apiKey: env.PAID_API_KEY,
    productExternalId: env.PAID_PRODUCT_EXTERNAL_ID,
    productIds: {
      pro: env.PAID_PRODUCT_PRO_ID,
      credits_5: env.PAID_PRODUCT_CREDITS_5_ID,
      credits_10: env.PAID_PRODUCT_CREDITS_10_ID,
    },
  };
}

/** Total spendable credits across every pool for the customer (0 if none/unknown). */
export async function getAvailableCredits(
  billing: PaidBilling,
  externalId: string,
): Promise<number> {
  try {
    const balances =
      await billing.client.customers.getCustomerCreditBalancesByExternalId({
        externalId,
      });
    return (balances.data ?? []).reduce((sum, pool) => sum + (pool.available ?? 0), 0);
  } catch (error) {
    // A missing customer (404) means no grants yet → no credits.
    console.warn("[billing] getAvailableCredits failed", externalId, error);
    return 0;
  }
}

/**
 * Ensure a Paid customer exists for this user, keyed by `externalId = user.id`.
 * Idempotent: resolves the existing customer or creates one. Best-effort.
 * Returns the Paid customer id, or `null` if the call failed.
 */
export async function ensurePaidCustomer(
  billing: PaidBilling,
  user: { id: string; name: string; email: string },
): Promise<string | null> {
  try {
    const existing = await billing.client.customers.getCustomerByExternalId({
      externalId: user.id,
    });
    return existing.id;
  } catch {
    // Not found (or transient). Try to create.
  }

  try {
    const created = await billing.client.customers.createCustomer({
      name: user.name || user.email,
      email: user.email,
      externalId: user.id,
    });
    return created.id;
  } catch (error) {
    console.warn("[billing] ensurePaidCustomer failed", user.id, error);
    return null;
  }
}

export type GrantCreditsResult = "granted" | "customer-missing" | "error";

/**
 * Grant spendable credits to a customer (`externalId = user.id`), optionally
 * expiring. Used for the free plan's monthly allowance — expiry stops unused
 * free credits stacking across months.
 */
export async function grantCredits(
  billing: PaidBilling,
  externalId: string,
  input: { amount: number; expiresAt?: Date },
): Promise<GrantCreditsResult> {
  try {
    const res = await fetch(
      `${PAID_API_BASE}/customers/external/${encodeURIComponent(externalId)}/credits/grants`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${billing.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creditCurrencyKey: CREDIT_CURRENCY_KEY,
          amount: input.amount,
          ...(input.expiresAt ? { expiresAt: input.expiresAt.toISOString() } : {}),
        }),
      },
    );
    if (res.ok) return "granted";
    if (res.status === 404) return "customer-missing";
    console.warn(
      "[billing] grantCredits failed",
      externalId,
      res.status,
      await res.text(),
    );
    return "error";
  } catch (error) {
    console.warn("[billing] grantCredits failed", externalId, error);
    return "error";
  }
}

/** Fire a usage signal. Best-effort; callers should not await this on the hot path. */
export async function sendUsageSignal(
  billing: PaidBilling,
  input: { eventName: string; externalCustomerId: string; idempotencyKey?: string },
): Promise<void> {
  try {
    await billing.client.signals.createSignals({
      signals: [
        {
          eventName: input.eventName,
          customer: { externalCustomerId: input.externalCustomerId },
          ...(billing.productExternalId
            ? { attribution: { externalProductId: billing.productExternalId } }
            : {}),
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        },
      ],
    });
  } catch (error) {
    console.warn("[billing] sendUsageSignal failed", input.eventName, error);
  }
}
