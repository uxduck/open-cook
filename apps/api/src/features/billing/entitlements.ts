import { getAvailableCredits, type PaidBilling } from "./paidClient";

/** Free-plan recipe cap. Pro is unlimited. */
export const RECIPE_LIMIT_FREE = 1000;

/** Credit cost per metered action (must match the Paid product pricing config). */
export const RESTYLE_CREDITS = 25;
export const STORY_CREDITS = 50;

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
