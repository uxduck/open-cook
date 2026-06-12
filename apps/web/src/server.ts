import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

const API_PREFIXES = ["/api", "/docs", "/scalar"];
const localApiUnavailableBody = JSON.stringify({
  error: "Local API worker is unavailable. Start it with `pnpm -C apps/api dev`.",
});

function isApiRequest(pathname: string): boolean {
  return (
    pathname === "/openapi.json" ||
    API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

function localApiUnavailableResponse() {
  return new Response(localApiUnavailableBody, {
    headers: { "content-type": "application/json; charset=utf-8" },
    status: 503,
  });
}

// Custom server entry: proxy API/docs traffic to the API Worker (service binding
// in production, the local API dev server otherwise), and let TanStack Start
// handle SSR + static assets for everything else.
export default createServerEntry({
  async fetch(request) {
    const url = new URL(request.url);
    if (isApiRequest(url.pathname)) {
      if (env.API) {
        return env.API.fetch(request);
      }
      const devUrl = `http://127.0.0.1:8787${url.pathname}${url.search}`;
      try {
        return await fetch(new Request(devUrl, request));
      } catch {
        return localApiUnavailableResponse();
      }
    }
    return handler.fetch(request);
  },
});
