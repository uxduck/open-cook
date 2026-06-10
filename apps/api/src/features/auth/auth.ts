import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie, expireCookie } from "better-auth/cookies";
import {
  bearer,
  emailOTP,
  magicLink,
  openAPI,
  twoFactor,
  username,
} from "better-auth/plugins";
import { eq, lte } from "drizzle-orm";
import type { ReactElement } from "react";
import { Resend } from "resend";
import type { Database } from "../../db/db";
import * as schema from "../../db/schema";
import { createPaidBilling, ensurePaidCustomer } from "../billing/paidClient";
import { DISPOSABLE_DOMAINS } from "./disposableEmailDomains";
import { emailDomain, normalizeEmail } from "./emailNormalization";
import {
  DeleteAccount,
  MagicLink as MagicLinkEmail,
  OtpCode,
  ResetPassword,
  VerifyEmail,
} from "../emails";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  username?: string | null;
  displayUsername?: string | null;
  twoFactorEnabled?: boolean | null;
  plan?: string | null;
  paidCustomerId?: string | null;
};

export type AuthSession = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuthEnv = {
  AUTH_BASE_URL?: string;
  AUTH_PASSKEY_RP_ID?: string;
  AUTH_SECRET?: string;
  AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
  WEBSITE_URL?: string;
  PAID_API_KEY?: string;
  PAID_ORGANIZATION_ID?: string;
  PAID_PRODUCT_EXTERNAL_ID?: string;
};

type CreateAuthInput = {
  db: Database;
  env: AuthEnv;
  executionCtx: ExecutionContext;
  requestOrigin?: string | undefined;
  requestUrl: string;
};

type AuthDelivery = {
  email: string;
  subject: string;
  react: ReactElement;
  text: string;
};

export type Auth = {
  handler: (request: Request) => Response | Promise<Response>;
  api: {
    getSession(input: {
      headers: Headers;
      query?: { disableCookieCache?: boolean };
    }): Promise<{ user: AuthUser; session: AuthSession } | null>;
  };
};

const TWO_FACTOR_TABLE_NAME = "twoFactor";
const TWO_FACTOR_COOKIE_NAME = "two_factor";
const TRUST_DEVICE_COOKIE_NAME = "trust_device";
const TRUST_DEVICE_IDENTIFIER_PREFIX = "trust-device-";
const DEFAULT_TWO_FACTOR_COOKIE_MAX_AGE_SECONDS = 10 * 60;
const DEFAULT_TRUST_DEVICE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_RESEND_FROM_EMAIL = "OpenCook <onboarding@resend.dev>";
const DEFAULT_DEV_WEBSITE_URL = "http://127.0.0.1:5173";
const EMAIL_VERIFICATION_SIGN_IN_RESEND_COOLDOWN_MS = 15 * 60 * 1000;
const EMAIL_VERIFICATION_SIGN_IN_RESEND_IDENTIFIER =
  "email-verification-sign-in-resend";
const LOCAL_DEV_ORIGIN_PATTERNS = [
  "http://localhost:*",
  "http://127.0.0.1:*",
  "http://[::1]:*",
  "https://localhost:*",
  "https://127.0.0.1:*",
  "https://[::1]:*",
];
const RANDOM_ID_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

type TwoFactorPluginOptions = {
  trustDeviceMaxAge?: number;
  twoFactorCookieMaxAge?: number;
  totpOptions?: {
    disable?: boolean;
  };
  otpOptions?: {
    sendOTP?: unknown;
  };
};

function splitOrigins(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

function originFor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function baseURLFor(env: AuthEnv, requestUrl: string): string {
  return env.BETTER_AUTH_URL ?? env.AUTH_BASE_URL ?? new URL(requestUrl).origin;
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function trustsLocalDevOrigins(env: AuthEnv, requestUrl: string): boolean {
  return [
    new URL(requestUrl).origin,
    originFor(env.WEBSITE_URL),
    originFor(env.BETTER_AUTH_URL),
    originFor(env.AUTH_BASE_URL),
  ].some((origin) => Boolean(origin && isLocalOrigin(origin)));
}

function secretFor(env: AuthEnv, baseURL: string): string {
  const secret = env.BETTER_AUTH_SECRET ?? env.AUTH_SECRET;
  if (secret) return secret;

  if (isLocalOrigin(baseURL)) {
    return "open-cook-local-dev-secret-change-me";
  }

  throw new Error("Set AUTH_SECRET or BETTER_AUTH_SECRET before enabling auth.");
}

export function trustedOriginsFor(env: AuthEnv, requestUrl: string): string[] {
  const requestOrigin = new URL(requestUrl).origin;
  const origins = [
    ...splitOrigins(env.AUTH_TRUSTED_ORIGINS),
    originFor(env.WEBSITE_URL),
    originFor(env.BETTER_AUTH_URL),
    originFor(env.AUTH_BASE_URL),
    requestOrigin,
  ];

  if (trustsLocalDevOrigins(env, requestUrl)) {
    origins.push(...LOCAL_DEV_ORIGIN_PATTERNS);
  }

  return unique(origins);
}

export function isTrustedOriginFor(
  env: AuthEnv,
  requestUrl: string,
  origin: string,
): boolean {
  if (trustsLocalDevOrigins(env, requestUrl) && isLocalOrigin(origin)) {
    return true;
  }
  return trustedOriginsFor(env, requestUrl).includes(origin);
}

function passkeyOriginFor(env: AuthEnv, requestUrl: string): string {
  return (
    originFor(env.WEBSITE_URL) ??
    originFor(env.BETTER_AUTH_URL) ??
    originFor(env.AUTH_BASE_URL) ??
    new URL(requestUrl).origin
  );
}

function logAuthDelivery(input: CreateAuthInput, delivery: AuthDelivery): void {
  input.executionCtx.waitUntil(
    Promise.resolve().then(() => {
      console.info(
        "[auth email]",
        JSON.stringify({
          email: delivery.email,
          subject: delivery.subject,
          text: delivery.text,
        }),
      );
    }),
  );
}

function authEnvValue(env: AuthEnv, name: keyof AuthEnv): string | undefined {
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  return env[name] ?? processEnv?.[name];
}

async function sendAuthDelivery(
  input: CreateAuthInput,
  delivery: AuthDelivery,
): Promise<void> {
  const apiKey = authEnvValue(input.env, "RESEND_API_KEY");
  if (!apiKey) {
    logAuthDelivery(input, delivery);
    return;
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: authEnvValue(input.env, "RESEND_FROM_EMAIL") ?? DEFAULT_RESEND_FROM_EMAIL,
    to: [delivery.email],
    subject: delivery.subject,
    react: delivery.react,
    text: delivery.text,
    replyTo: authEnvValue(input.env, "RESEND_REPLY_TO"),
  });

  if (error) {
    throw new Error(`Resend email delivery failed: ${error.message}`);
  }

  console.info(
    "[auth email] sent",
    JSON.stringify({
      provider: "resend",
      id: data?.id,
      to: delivery.email,
      subject: delivery.subject,
    }),
  );
}

function shouldThrottleVerificationEmail(request: Request | undefined): boolean {
  if (!request) return false;

  const pathname = new URL(request.url).pathname;
  return pathname.endsWith("/sign-in/email") || pathname.endsWith("/sign-in/username");
}

async function claimVerificationEmailSend(
  input: CreateAuthInput,
  user: { email: string; id: string },
  request: Request | undefined,
): Promise<boolean> {
  if (!shouldThrottleVerificationEmail(request)) {
    return true;
  }

  const nowMs = Date.now();
  const now = new Date(nowMs);
  const expiresAt = new Date(nowMs + EMAIL_VERIFICATION_SIGN_IN_RESEND_COOLDOWN_MS);
  const throttleId = `${EMAIL_VERIFICATION_SIGN_IN_RESEND_IDENTIFIER}:${user.id}`;

  const rows = await input.db
    .insert(schema.verification)
    .values({
      id: throttleId,
      identifier: EMAIL_VERIFICATION_SIGN_IN_RESEND_IDENTIFIER,
      value: user.email,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.verification.id,
      set: {
        value: user.email,
        expiresAt,
        updatedAt: now,
      },
      setWhere: lte(schema.verification.expiresAt, now),
    })
    .returning({ id: schema.verification.id });

  return rows.length > 0;
}

function websiteOriginFor(
  env: AuthEnv,
  baseURL: string,
  requestOrigin: string | undefined,
): string {
  const configured = originFor(authEnvValue(env, "WEBSITE_URL"));
  if (configured) return configured;
  // In local dev the API (wrangler) and the website (vite) run on different ports.
  if (isLocalOrigin(baseURL) && requestOrigin && isLocalOrigin(requestOrigin)) {
    return new URL(requestOrigin).origin;
  }
  if (isLocalOrigin(baseURL)) return DEFAULT_DEV_WEBSITE_URL;
  return new URL(baseURL).origin;
}

function withWebsiteCallback(url: string, websiteOrigin: string, path: string): string {
  const target = new URL(url);
  target.searchParams.set("callbackURL", new URL(path, websiteOrigin).href);
  return target.href;
}

function otpEmailCopy(type: string): { subject: string; title: string; intro: string } {
  switch (type) {
    case "sign-in":
      return {
        subject: "Your OpenCook sign-in code",
        title: "Sign in to OpenCook",
        intro: "Use this code to finish signing in.",
      };
    case "email-verification":
      return {
        subject: "Your OpenCook verification code",
        title: "Verify your email",
        intro: "Use this code to verify your email address.",
      };
    case "forget-password":
      return {
        subject: "Your OpenCook password reset code",
        title: "Reset your password",
        intro: "Use this code to reset your password.",
      };
    default:
      return {
        subject: "Your OpenCook code",
        title: "Your confirmation code",
        intro: "Use this code to continue.",
      };
  }
}

function isTrustDeviceIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(TRUST_DEVICE_IDENTIFIER_PREFIX);
}

function randomAuthIdentifier(length: number): string {
  let result = "";
  const bytes = new Uint8Array(length * 2);
  const maxByte =
    Math.floor(256 / RANDOM_ID_ALPHABET.length) * RANDOM_ID_ALPHABET.length;

  while (result.length < length) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= maxByte) continue;
      result += RANDOM_ID_ALPHABET[byte % RANDOM_ID_ALPHABET.length];
      if (result.length === length) break;
    }
  }

  return result;
}

async function hmacSha256Base64UrlNoPad(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(data)),
  );
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function openCookSessionTwoFactor(): BetterAuthPlugin {
  return {
    id: "open-cook-session-two-factor",
    hooks: {
      after: [
        {
          matcher(context) {
            return (
              context.path === "/magic-link/verify" ||
              context.path === "/passkey/verify-authentication" ||
              context.path === "/sign-in/email-otp" ||
              context.path === "/email-otp/verify-email"
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            const data = ctx.context.newSession;
            if (!data?.user.twoFactorEnabled) return;

            const plugin = ctx.context.getPlugin("two-factor") as
              | { options?: TwoFactorPluginOptions }
              | undefined;
            const options = plugin?.options ?? {};
            const trustDeviceMaxAge =
              options.trustDeviceMaxAge ?? DEFAULT_TRUST_DEVICE_MAX_AGE_SECONDS;
            const trustDeviceCookie = ctx.context.createAuthCookie(
              TRUST_DEVICE_COOKIE_NAME,
              {
                maxAge: trustDeviceMaxAge,
              },
            );
            const trustDeviceValue = await ctx.getSignedCookie(
              trustDeviceCookie.name,
              ctx.context.secret,
            );

            if (trustDeviceValue) {
              const [token, trustIdentifier] = trustDeviceValue.split("!");
              if (token && isTrustDeviceIdentifier(trustIdentifier)) {
                const expectedToken = await hmacSha256Base64UrlNoPad(
                  ctx.context.secret,
                  `${data.user.id}!${trustIdentifier}`,
                );
                const verificationRecord =
                  token === expectedToken
                    ? await ctx.context.internalAdapter.findVerificationValue(
                        trustIdentifier,
                      )
                    : null;

                if (
                  verificationRecord?.value === data.user.id &&
                  verificationRecord.expiresAt > new Date()
                ) {
                  return;
                }
              }

              expireCookie(ctx, trustDeviceCookie);
            }

            deleteSessionCookie(ctx, true);
            await ctx.context.internalAdapter.deleteSession(data.session.token);

            const maxAge =
              options.twoFactorCookieMaxAge ??
              DEFAULT_TWO_FACTOR_COOKIE_MAX_AGE_SECONDS;
            const twoFactorCookie = ctx.context.createAuthCookie(
              TWO_FACTOR_COOKIE_NAME,
              {
                maxAge,
              },
            );
            const identifier = `2fa-${randomAuthIdentifier(20)}`;
            await ctx.context.internalAdapter.createVerificationValue({
              value: data.user.id,
              identifier,
              expiresAt: new Date(Date.now() + maxAge * 1000),
            });
            await ctx.setSignedCookie(
              twoFactorCookie.name,
              identifier,
              ctx.context.secret,
              twoFactorCookie.attributes,
            );

            const twoFactorMethods: string[] = [];
            if (!options.totpOptions?.disable) {
              const totpRecord = await ctx.context.adapter.findOne({
                model: TWO_FACTOR_TABLE_NAME,
                where: [{ field: "userId", value: data.user.id }],
              });
              if (
                totpRecord &&
                (totpRecord as { verified?: boolean }).verified !== false
              ) {
                twoFactorMethods.push("totp");
              }
            }
            if (options.otpOptions?.sendOTP) twoFactorMethods.push("otp");

            return ctx.json({
              twoFactorRedirect: true,
              twoFactorMethods,
            });
          }),
        },
      ],
    },
  };
}

export function createAuth(input: CreateAuthInput): Auth {
  const baseURL = baseURLFor(input.env, input.requestUrl);
  const websiteOrigin = websiteOriginFor(input.env, baseURL, input.requestOrigin);
  const passkeyOrigin = passkeyOriginFor(input.env, input.requestUrl);
  const passkeyRpID = input.env.AUTH_PASSKEY_RP_ID ?? new URL(passkeyOrigin).hostname;

  return betterAuth({
    appName: "OpenCook",
    basePath: "/api/auth",
    baseURL,
    secret: secretFor(input.env, baseURL),
    trustedOrigins: trustedOriginsFor(input.env, input.requestUrl),
    trustedProxies: ["*"],
    database: drizzleAdapter(input.db, {
      schema,
      provider: "sqlite",
      camelCase: true,
      transaction: false,
    }),
    advanced: {
      cookiePrefix: "open-cook",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: baseURL.startsWith("https://"),
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthDelivery(input, {
          email: user.email,
          subject: "Reset your OpenCook password",
          react: ResetPassword({ resetUrl: url, userName: user.name }),
          text: `Reset password URL: ${url}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }, request) => {
        if (!(await claimVerificationEmailSend(input, user, request))) {
          return;
        }

        // Send the user to the web app after verifying, even when the API runs
        // on a different origin (local dev).
        const verifyUrl = withWebsiteCallback(url, websiteOrigin, "/app");
        await sendAuthDelivery(input, {
          email: user.email,
          subject: "Verify your OpenCook email",
          react: VerifyEmail({ verifyUrl, userName: user.name }),
          text: `Verification URL: ${verifyUrl}`,
        });
      },
    },
    user: {
      additionalFields: {
        plan: {
          type: "string",
          required: false,
          defaultValue: "free",
          input: false,
        },
        paidCustomerId: {
          type: "string",
          required: false,
          input: false,
        },
      },
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({ user, url }) => {
          const confirmUrl = withWebsiteCallback(url, websiteOrigin, "/");
          await sendAuthDelivery(input, {
            email: user.email,
            subject: "Confirm OpenCook account deletion",
            react: DeleteAccount({ confirmUrl, userName: user.name }),
            text: `Account deletion URL: ${confirmUrl}`,
          });
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 300,
      },
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    databaseHooks: {
      user: {
        create: {
          // Runs for every account-creation path (email/password, magic link,
          // email OTP). Compute the canonical email here so the
          // `normalized_email` NOT NULL + UNIQUE column is always populated and
          // alias/disposable abuse is blocked before the row is written.
          before: async (userData) => {
            const email = (userData as { email?: string }).email ?? "";
            const normalizedEmail = normalizeEmail(email);

            const domain = emailDomain(email);
            if (domain && DISPOSABLE_DOMAINS.has(domain)) {
              throw new APIError("UNPROCESSABLE_ENTITY", {
                message:
                  "Disposable email addresses are not allowed. Please use a permanent email address.",
                code: "DISPOSABLE_EMAIL",
              });
            }

            // Catch alias variants (e.g. johndoe+x@gmail.com vs the existing
            // johndoe@gmail.com) that share a canonical form but differ as raw
            // strings, so they can't slip past Better Auth's exact-email check.
            const existing = await input.db
              .select({ id: schema.user.id })
              .from(schema.user)
              .where(eq(schema.user.normalizedEmail, normalizedEmail))
              .get();
            if (existing) {
              throw new APIError("UNPROCESSABLE_ENTITY", {
                message: "An account already exists for this email address.",
                code: "EMAIL_ALREADY_EXISTS",
              });
            }

            return { data: { ...userData, normalizedEmail } };
          },
          // Map every new OpenCook user to a Paid customer (externalId = user.id)
          // so usage signals, checkout and credit balances resolve. Best-effort
          // and off the signup hot path; lazily reconciled on the next billing call.
          after: async (createdUser) => {
            const billing = createPaidBilling(input.env);
            if (!billing) return;
            input.executionCtx.waitUntil(
              (async () => {
                const paidCustomerId = await ensurePaidCustomer(billing, {
                  id: createdUser.id,
                  name: createdUser.name,
                  email: createdUser.email,
                });
                if (paidCustomerId) {
                  await input.db
                    .update(schema.user)
                    .set({ paidCustomerId })
                    .where(eq(schema.user.id, createdUser.id));
                }
              })(),
            );
          },
        },
        update: {
          // Keep normalized_email in sync whenever the email changes (Better
          // Auth's changeEmail flow). The update hook fires on every user
          // mutation, so only rewrite when `email` is actually part of the
          // change. Otherwise normalized_email would go stale.
          before: async (userData) => {
            const email = (userData as { email?: string }).email;
            if (typeof email !== "string") return;
            return {
              data: { ...userData, normalizedEmail: normalizeEmail(email) },
            };
          },
        },
      },
    },
    plugins: [
      bearer(),
      username(),
      emailOTP({
        // Signup already sends the verification-link email; don't double up
        // with an OTP email too.
        changeEmail: {
          enabled: true,
          verifyCurrentEmail: true,
        },
        async sendVerificationOTP({ email, otp, type }) {
          const copy = otpEmailCopy(type);
          await sendAuthDelivery(input, {
            email,
            subject: copy.subject,
            react: OtpCode({ otp, title: copy.title, intro: copy.intro }),
            text: `${copy.subject}: ${otp}`,
          });
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          const signInUrl = withWebsiteCallback(url, websiteOrigin, "/app");
          await sendAuthDelivery(input, {
            email,
            subject: "Sign in to OpenCook",
            react: MagicLinkEmail({ signInUrl }),
            text: `Magic link URL: ${signInUrl}`,
          });
        },
      }),
      twoFactor({
        issuer: "OpenCook",
        allowPasswordless: true,
        otpOptions: {
          async sendOTP({ user, otp }) {
            await sendAuthDelivery(input, {
              email: user.email,
              subject: "Your OpenCook two-factor code",
              react: OtpCode({
                otp,
                title: "Two-factor check",
                intro: "Use this code to finish signing in.",
              }),
              text: `Two-factor code: ${otp}`,
            });
          },
        },
      }),
      passkey({
        rpName: "OpenCook",
        rpID: passkeyRpID,
        origin: passkeyOrigin,
      }),
      openCookSessionTwoFactor(),
      openAPI({ path: "/reference" }),
    ],
  }) as unknown as Auth;
}
