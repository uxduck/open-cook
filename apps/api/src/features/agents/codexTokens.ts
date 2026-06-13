import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "../../db/db";
import { agentTokens, user } from "../../db/schema";
import type { AuthSession, AuthUser } from "../auth/auth";

const codexTokenPrefix = "oc_codex_";
const tokenByteLength = 32;

export type CodexConnection = {
  createdAt: string;
  id: string;
  lastUsedAt: string | null;
  name: string;
  tokenPrefix: string;
};

export type CreatedCodexConnection = CodexConnection & {
  apiBase: string;
  env: string;
  pluginName: "opencook";
  token: string;
};

export function isCodexConnectionToken(token: string) {
  return token.startsWith(codexTokenPrefix);
}

export async function createCodexConnection({
  apiBase,
  db,
  name,
  userId,
}: {
  apiBase: string;
  db: Database;
  name?: string;
  userId: string;
}): Promise<CreatedCodexConnection> {
  const token = createToken();
  const tokenHash = await hashToken(token);
  const tokenPrefix = `${codexTokenPrefix}${token.slice(codexTokenPrefix.length, codexTokenPrefix.length + 8)}`;
  const createdAt = new Date();
  const displayName = cleanConnectionName(name);

  const row = {
    createdAt,
    id: crypto.randomUUID(),
    name: displayName,
    tokenHash,
    tokenPrefix,
    userId,
  };

  await db.insert(agentTokens).values(row);

  return {
    apiBase,
    createdAt: createdAt.toISOString(),
    env: `OPEN_COOK_API_BASE=${apiBase}\nOPEN_COOK_AUTH_TOKEN=${token}`,
    id: row.id,
    lastUsedAt: null,
    name: displayName,
    pluginName: "opencook",
    token,
    tokenPrefix,
  };
}

export async function listCodexConnections(
  db: Database,
  userId: string,
): Promise<CodexConnection[]> {
  const rows = await db
    .select({
      createdAt: agentTokens.createdAt,
      id: agentTokens.id,
      lastUsedAt: agentTokens.lastUsedAt,
      name: agentTokens.name,
      tokenPrefix: agentTokens.tokenPrefix,
    })
    .from(agentTokens)
    .where(and(eq(agentTokens.userId, userId), isNull(agentTokens.revokedAt)))
    .orderBy(desc(agentTokens.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }));
}

export async function revokeCodexConnection({
  db,
  id,
  userId,
}: {
  db: Database;
  id: string;
  userId: string;
}) {
  await db
    .update(agentTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(agentTokens.id, id),
        eq(agentTokens.userId, userId),
        isNull(agentTokens.revokedAt),
      ),
    );
}

export async function resolveCodexConnectionToken(
  db: Database,
  token: string,
): Promise<{ session: AuthSession; user: AuthUser } | null> {
  if (!isCodexConnectionToken(token)) {
    return null;
  }

  const tokenHash = await hashToken(token);
  const row = await db
    .select({
      createdAt: agentTokens.createdAt,
      displayUsername: user.displayUsername,
      email: user.email,
      emailVerified: user.emailVerified,
      id: agentTokens.id,
      image: user.image,
      name: user.name,
      paidCustomerId: user.paidCustomerId,
      plan: user.plan,
      tokenPrefix: agentTokens.tokenPrefix,
      twoFactorEnabled: user.twoFactorEnabled,
      updatedAt: agentTokens.lastUsedAt,
      userId: user.id,
      username: user.username,
    })
    .from(agentTokens)
    .innerJoin(user, eq(user.id, agentTokens.userId))
    .where(and(eq(agentTokens.tokenHash, tokenHash), isNull(agentTokens.revokedAt)))
    .get();

  if (!row) {
    return null;
  }

  const now = new Date();
  await db
    .update(agentTokens)
    .set({ lastUsedAt: now })
    .where(eq(agentTokens.id, row.id));

  return {
    session: {
      createdAt: row.createdAt,
      expiresAt: new Date("9999-12-31T23:59:59.999Z"),
      id: `agent:${row.id}`,
      ipAddress: null,
      token: row.tokenPrefix,
      updatedAt: row.updatedAt ?? row.createdAt,
      userAgent: "OpenCook Codex plugin",
      userId: row.userId,
    },
    user: {
      displayUsername: row.displayUsername,
      email: row.email,
      emailVerified: row.emailVerified,
      id: row.userId,
      image: row.image,
      name: row.name,
      paidCustomerId: row.paidCustomerId,
      plan: row.plan,
      twoFactorEnabled: row.twoFactorEnabled,
      username: row.username,
    },
  };
}

function cleanConnectionName(name?: string) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 80) : "Codex";
}

function createToken() {
  const bytes = new Uint8Array(tokenByteLength);
  crypto.getRandomValues(bytes);
  return `${codexTokenPrefix}${hex(bytes)}`;
}

async function hashToken(token: string) {
  const encoded = new TextEncoder().encode(token);
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoded)));
}

function hex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
