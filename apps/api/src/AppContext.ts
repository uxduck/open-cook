import type { ImageAssetStore } from "./assets/imageAssets";
import type { Database } from "./db/db";
import type { Auth, AuthSession, AuthUser } from "./features/auth/auth";
import type { RecipeStore } from "./storage/types";

export type Env = {
  Bindings: {
    DB?: D1Database;
    RECIPE_IMAGES?: R2Bucket;
    ASSETS_PUBLIC_BASE_URL?: string;
    AUTH_BASE_URL?: string;
    AUTH_PASSKEY_RP_ID?: string;
    AUTH_SECRET?: string;
    AUTH_TRUSTED_ORIGINS?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    WEBSITE_URL?: string;
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
