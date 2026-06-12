import { env } from "cloudflare:workers";

const localApiOrigin = "http://127.0.0.1:8787";

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function configuredApiOrigin(): string | undefined {
  const processLike = (globalThis as { process?: ProcessLike }).process;
  const origin =
    processLike?.env?.OPEN_COOK_API_ORIGIN ?? processLike?.env?.OPEN_COOK_API_BASE;
  if (!origin) return undefined;

  try {
    return new URL(origin).origin;
  } catch {
    throw new Error(`Invalid OPEN_COOK_API_ORIGIN: ${origin}`);
  }
}

function apiOrigin(): string {
  return configuredApiOrigin() ?? localApiOrigin;
}

export function isConfiguredApiOrigin(): boolean {
  return configuredApiOrigin() !== undefined;
}

export function apiUrl(path: string): string {
  return new URL(path, apiOrigin()).href;
}

export async function fetchApiPath(path: string, init?: RequestInit): Promise<Response> {
  if (env.API) {
    return env.API.fetch(new Request(`https://api.internal${path}`, init));
  }
  return fetch(apiUrl(path), init);
}

export async function proxyApiRequest(request: Request): Promise<Response> {
  if (env.API) {
    return env.API.fetch(request);
  }

  const url = new URL(request.url);
  return fetch(new Request(apiUrl(`${url.pathname}${url.search}`), request));
}
