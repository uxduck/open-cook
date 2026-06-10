import type { ImageAssetStore } from "./assets/imageAssets";
import type { Database } from "./db/db";
import type { Auth, AuthSession, AuthUser } from "./features/auth/auth";
import type { RecipeStore } from "./storage/types";

export type Env = {
  Bindings: {
    AI?: Ai;
    DB?: D1Database;
    RECIPE_IMAGES?: R2Bucket;
    ASSETS_PUBLIC_BASE_URL?: string;
    CF_ACCOUNT_ID?: string;
    CF_IMAGES_ACCOUNT_HASH?: string;
    CF_IMAGES_TOKEN?: string;
    CF_IMAGES_VARIANT?: string;
    AUTH_BASE_URL?: string;
    AUTH_PASSKEY_RP_ID?: string;
    AUTH_SECRET?: string;
    AUTH_TRUSTED_ORIGINS?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    RESEND_REPLY_TO?: string;
    WORKERS_AI_MODEL?: string;
    WORKERS_AI_RECIPE_IMAGE_MODEL?: string;
    WORKERS_AI_RECIPE_REMIX_MODEL?: string;
    WORKERS_AI_RECIPE_STRUCTURE_MODEL?: string;
    WEBSITE_URL?: string;
    DEEPGRAM_API_KEY?: string;
    PAID_API_KEY?: string;
    PAID_ORGANIZATION_ID?: string;
    PAID_WEBHOOK_SECRET?: string;
    PAID_PRODUCT_EXTERNAL_ID?: string;
    PAID_PRODUCT_PRO_ID?: string;
    PAID_PRODUCT_CREDITS_5_ID?: string;
    PAID_PRODUCT_CREDITS_10_ID?: string;
  };
  Variables: {
    auth: Auth | null;
    authSessionResolutionFailed: boolean;
    assets: ImageAssetStore;
    db: Database | null;
    session: AuthSession | null;
    store: RecipeStore;
    user: AuthUser | null;
  };
};
