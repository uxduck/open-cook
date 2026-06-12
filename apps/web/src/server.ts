import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { isConfiguredApiOrigin, proxyApiRequest } from "./server/apiProxy";

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
      try {
        return await proxyApiRequest(request);
      } catch {
        if (isConfiguredApiOrigin()) {
          return new Response(
            JSON.stringify({ error: "Configured API origin is unavailable." }),
            {
              headers: { "content-type": "application/json; charset=utf-8" },
              status: 503,
            },
          );
        }
        return localApiUnavailableResponse();
      }
    }
    return handler.fetch(request);
  },
});
