import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

const remoteDatabaseIds = {
  production: "391c5e5e-8cae-4d7b-b819-a3775b8d649c",
  staging: undefined,
} as const;

type RemoteStudioTarget = keyof typeof remoteDatabaseIds;

const localD1DatabaseDirectory = resolve(
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    const value = match[2].trim();
    process.env[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
}

function findLocalD1DatabaseFile() {
  if (!existsSync(localD1DatabaseDirectory)) {
    return undefined;
  }

  return readdirSync(localD1DatabaseDirectory)
    .filter((fileName) => fileName.endsWith(".sqlite"))
    .filter((fileName) => fileName !== "metadata.sqlite")
    .map((fileName) => resolve(localD1DatabaseDirectory, fileName))
    .sort()[0];
}

function getRemoteStudioTarget(): RemoteStudioTarget | undefined {
  const target = process.env.DRIZZLE_STUDIO_TARGET;

  if (!target) {
    return undefined;
  }

  if (target === "production" || target === "staging") {
    return target;
  }

  throw new Error("DRIZZLE_STUDIO_TARGET must be either 'production' or 'staging'.");
}

function getRequiredEnv(name: string, fallbackName?: string) {
  const value =
    process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);

  if (!value) {
    throw new Error(
      `Missing ${name}${fallbackName ? ` or ${fallbackName}` : ""} for remote Drizzle Studio.`,
    );
  }

  return value;
}

function getRemoteDatabaseId(target: RemoteStudioTarget) {
  const upperTarget = target.toUpperCase();

  const databaseId =
    process.env[`DRIZZLE_STUDIO_${upperTarget}_DATABASE_ID`] ??
    process.env[`CLOUDFLARE_D1_${upperTarget}_DATABASE_ID`] ??
    process.env.DRIZZLE_STUDIO_DATABASE_ID ??
    process.env.CLOUDFLARE_D1_DATABASE_ID ??
    remoteDatabaseIds[target];

  if (!databaseId) {
    throw new Error(
      `Missing DRIZZLE_STUDIO_${upperTarget}_DATABASE_ID or CLOUDFLARE_D1_${upperTarget}_DATABASE_ID for remote Drizzle Studio.`,
    );
  }

  return databaseId;
}

loadEnvFile(resolve(".env"));
loadEnvFile(resolve("../../.env"));

const localD1DatabaseFile =
  process.env.DRIZZLE_STUDIO_DB_FILE ?? findLocalD1DatabaseFile();
const remoteStudioTarget = getRemoteStudioTarget();

const baseConfig = {
  out: "./drizzle",
  schema: "./src/db/schema.ts",
} as const;

const drizzleConfig = remoteStudioTarget
  ? defineConfig({
      ...baseConfig,
      dialect: "sqlite",
      driver: "d1-http",
      dbCredentials: {
        accountId: getRequiredEnv("DRIZZLE_STUDIO_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"),
        databaseId: getRemoteDatabaseId(remoteStudioTarget),
        token: getRequiredEnv("DRIZZLE_STUDIO_API_TOKEN", "CLOUDFLARE_API_TOKEN"),
      },
    })
  : defineConfig({
      ...baseConfig,
      dialect: "sqlite",
      ...(localD1DatabaseFile
        ? {
            dbCredentials: {
              url: localD1DatabaseFile,
            },
          }
        : {}),
    });

export default drizzleConfig;
