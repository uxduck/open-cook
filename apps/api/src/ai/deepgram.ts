import type { Env } from "../AppContext";

/** A short-lived Deepgram JWT minted server-side so the browser can open a
 * streaming WebSocket directly to Deepgram without ever seeing the long-lived
 * API key. Uses Deepgram's purpose-built `/v1/auth/grant` endpoint, which is
 * NOT project-scoped — it only needs an API key with Member+ permission.
 * The returned token carries `usage:write` and expires quickly. */
export type DeepgramToken = {
  token: string;
  expiresInSeconds: number;
};

export class DeepgramUnavailableError extends Error {}
export class DeepgramRequestError extends Error {}

const TOKEN_TTL_SECONDS = 60;

export async function createDeepgramToken(
  env: Env["Bindings"],
): Promise<DeepgramToken> {
  const apiKey = env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new DeepgramUnavailableError("Deepgram voice is not configured.");
  }

  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
  });

  if (!response.ok) {
    throw new DeepgramRequestError(
      `Deepgram token request failed (${response.status}).`,
    );
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new DeepgramRequestError("Deepgram did not return a token.");
  }

  return {
    token: body.access_token,
    expiresInSeconds: body.expires_in ?? TOKEN_TTL_SECONDS,
  };
}
