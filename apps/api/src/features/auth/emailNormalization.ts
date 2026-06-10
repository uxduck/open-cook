/**
 * Normalize an email address for abuse-prevention uniqueness checks.
 *
 * Rules:
 * - Lowercase and trim the whole address.
 * - Gmail/Googlemail: strip dots from the local part AND everything after `+`
 *   (so `u.ser+tag@gmail.com` and `user@gmail.com` collapse to one identity).
 * - Outlook/Hotmail/Yahoo/Live/Proton/iCloud/Fastmail: strip the `+` suffix
 *   only (dots are significant for these providers).
 * - Apple Private Relay and every other domain: lowercase only, so we never
 *   merge or break legitimate addresses we don't understand.
 *
 * The result is a canonical key, not a deliverable address. Always send mail
 * to the address the user actually typed (or the stored `email`), never to the
 * normalized form.
 */

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

const PLUS_STRIPPABLE_DOMAINS = new Set([
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "ymail.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "icloud.com",
  "me.com",
  "mac.com",
  "fastmail.com",
]);

export function normalizeEmail(email: string): string {
  const lower = email.toLowerCase().trim();
  const atIdx = lower.lastIndexOf("@");
  if (atIdx === -1) return lower;

  let local = lower.slice(0, atIdx);
  const domain = lower.slice(atIdx + 1);

  if (GMAIL_DOMAINS.has(domain)) {
    // Strip dots and + suffix for Gmail.
    const plusIdx = local.indexOf("+");
    if (plusIdx !== -1) local = local.slice(0, plusIdx);
    local = local.replaceAll(".", "");
  } else if (PLUS_STRIPPABLE_DOMAINS.has(domain)) {
    // Strip + suffix only (dots are significant).
    const plusIdx = local.indexOf("+");
    if (plusIdx !== -1) local = local.slice(0, plusIdx);
  }

  return `${local}@${domain}`;
}

/**
 * Extract the lowercased domain from an email address, or `undefined` when the
 * input has no `@`.
 */
export function emailDomain(email: string): string | undefined {
  const normalized = normalizeEmail(email);
  const domain = normalized.slice(normalized.lastIndexOf("@") + 1);
  return domain.length > 0 && normalized.includes("@") ? domain : undefined;
}
