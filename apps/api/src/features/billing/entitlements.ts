import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../../db/db";
import { user as userTable } from "../../db/schema";
import {
  ensurePaidCustomer,
  getAvailableCredits,
  grantCredits,
  type PaidBilling,
} from "./paidClient";

/**
 * TEMPORARY (since 2026-06-10): all AI generation (Theme, Adapt, Story, …) is
 * free for every user. While true, the remix endpoint skips the credit check
 * and the usage signal, so nobody's balance is consumed or charged during the
 * free period. Set back to false to restore the paywall.
 */
export const AI_PAYWALL_DISABLED = true;

/** Free-plan recipe cap. Pro is unlimited. */
export const RECIPE_LIMIT_FREE = 1000;

/** Credit cost per metered action (must match the Paid product pricing config). */
export const RESTYLE_CREDITS = 25;
export const STORY_CREDITS = 50;

/** Free-plan monthly allowance: 3 restyles, granted as expiring credits. */
export const FREE_MONTHLY_CREDITS = RESTYLE_CREDITS * 3;

/** Rolling 30-day window for the free allowance. Each grant expires exactly
 * when the next one becomes due, so unused free credits never stack. */
const FREE_GRANT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export type BillingLimitReason = "recipe_limit" | "restyle_quota";

/** Thrown when a metered action is denied. Handlers translate this to HTTP 402. */
export class BillingLimitError extends Error {
  readonly reason: BillingLimitReason;
  readonly limit?: number;

  constructor(reason: BillingLimitReason, limit?: number) {
    super(`Billing limit reached: ${reason}`);
    this.name = "BillingLimitError";
    this.reason = reason;
    this.limit = limit;
  }
}

export function isFreePlan(user: { plan?: string | null } | null): boolean {
  return (user?.plan ?? "free") === "free";
}

/**
 * Lazily top up a free-plan user's monthly credit allowance in Paid. Called
 * from the restyle gate and `/billing/me`, so the grant lands the first time
 * a user touches a metered feature each period — no cron needed. No-op for
 * Pro users, unconfigured billing, or when the current window's grant exists.
 */
export async function ensureFreeMonthlyCredits(
  billing: PaidBilling | null,
  db: Database | null,
  userId: string,
): Promise<void> {
  if (!billing || !db) return;

  const row = await db
    .select({
      plan: userTable.plan,
      grantedAt: userTable.freeCreditsGrantedAt,
      name: userTable.name,
      email: userTable.email,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .get();
  if (!row || row.plan !== "free") return;

  const now = new Date();
  if (row.grantedAt && now.getTime() - row.grantedAt.getTime() < FREE_GRANT_PERIOD_MS) {
    return;
  }

  // Claim the window first so concurrent requests can't double-grant: only
  // the request whose conditional update lands makes the Paid call.
  const claim = await db
    .update(userTable)
    .set({ freeCreditsGrantedAt: now })
    .where(
      and(
        eq(userTable.id, userId),
        row.grantedAt
          ? eq(userTable.freeCreditsGrantedAt, row.grantedAt)
          : isNull(userTable.freeCreditsGrantedAt),
      ),
    )
    .run();
  if (!claim.meta.changes) return;

  const expiresAt = new Date(now.getTime() + FREE_GRANT_PERIOD_MS);
  let result = await grantCredits(billing, userId, {
    amount: FREE_MONTHLY_CREDITS,
    expiresAt,
  });
  if (result === "customer-missing") {
    // Signup's Paid customer creation is best-effort; reconcile and retry once.
    await ensurePaidCustomer(billing, {
      id: userId,
      name: row.name,
      email: row.email,
    });
    result = await grantCredits(billing, userId, {
      amount: FREE_MONTHLY_CREDITS,
      expiresAt,
    });
  }
  if (result !== "granted") {
    // Release the claim (only if still ours) so a later request can retry.
    await db
      .update(userTable)
      .set({ freeCreditsGrantedAt: row.grantedAt ?? null })
      .where(and(eq(userTable.id, userId), eq(userTable.freeCreditsGrantedAt, now)))
      .run();
  }
}

/**
 * Gate a recipe restyle. Paid is the source of truth for the monthly allowance
 * (free: 3/mo, Pro: 20/mo, modelled as monthly credit grants) plus any purchased
 * credit packs. When billing is not configured (`billing` is null), the action is
 * allowed so local/dev flows keep working.
 */
export async function assertRestyleAllowed(
  billing: PaidBilling | null,
  externalId: string,
): Promise<void> {
  if (!billing) return;
  const available = await getAvailableCredits(billing, externalId);
  if (available < RESTYLE_CREDITS) {
    throw new BillingLimitError("restyle_quota");
  }
}
