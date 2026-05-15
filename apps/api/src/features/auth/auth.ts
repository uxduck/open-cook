import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie, expireCookie } from "better-auth/cookies";
import {
  bearer,
  emailOTP,
  magicLink,
  openAPI,
  twoFactor,
  username,
} from "better-auth/plugins";
import type { Database } from "../../db/db";
import * as schema from "../../db/schema";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  username?: string | null;
  displayUsername?: string | null;
  twoFactorEnabled?: boolean | null;
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
  WEBSITE_URL?: string;
};

type CreateAuthInput = {
  db: Database;
  env: AuthEnv;
  executionCtx: ExecutionContext;
  requestUrl: string;
};

type AuthDelivery = {
  email: string;
  subject: string;
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

function isLocalOrigin(origin: string): boolean {
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
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
  return unique([
    ...splitOrigins(env.AUTH_TRUSTED_ORIGINS),
    originFor(env.WEBSITE_URL),
    originFor(env.BETTER_AUTH_URL),
    originFor(env.AUTH_BASE_URL),
    requestOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
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
      console.info("[auth email]", JSON.stringify(delivery));
    }),
  );
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
        logAuthDelivery(input, {
          email: user.email,
          subject: "Reset your OpenCook password",
          text: `Reset password URL: ${url}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        logAuthDelivery(input, {
          email: user.email,
          subject: "Verify your OpenCook email",
          text: `Verification URL: ${url}`,
        });
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({ user, url }) => {
          logAuthDelivery(input, {
            email: user.email,
            subject: "Confirm OpenCook account deletion",
            text: `Account deletion URL: ${url}`,
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
    plugins: [
      bearer(),
      username(),
      emailOTP({
        sendVerificationOnSignUp: true,
        changeEmail: {
          enabled: true,
          verifyCurrentEmail: true,
        },
        async sendVerificationOTP({ email, otp, type }) {
          logAuthDelivery(input, {
            email,
            subject: `OpenCook ${type} code`,
            text: `OTP: ${otp}`,
          });
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          logAuthDelivery(input, {
            email,
            subject: "Sign in to OpenCook",
            text: `Magic link URL: ${url}`,
          });
        },
      }),
      twoFactor({
        issuer: "OpenCook",
        allowPasswordless: true,
        otpOptions: {
          async sendOTP({ user, otp }) {
            logAuthDelivery(input, {
              email: user.email,
              subject: "OpenCook two-factor code",
              text: `OTP: ${otp}`,
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
