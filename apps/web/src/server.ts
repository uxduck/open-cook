import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

const API_PREFIXES = ["/api", "/docs", "/scalar"];

function isApiRequest(pathname: string): boolean {
  return (
    pathname === "/openapi.json" ||
    API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

// Custom server entry: proxy API/docs traffic to the API Worker (service binding
// in production, the local API dev server otherwise), and let TanStack Start
// handle SSR + static assets for everything else.
export default createServerEntry({
  fetch(request) {
    const url = new URL(request.url);
    if (isApiRequest(url.pathname)) {
      if (env.API) {
        return env.API.fetch(request);
      }
      const devUrl = `http://127.0.0.1:8787${url.pathname}${url.search}`;
      return fetch(new Request(devUrl, request));
    }
    return handler.fetch(request);
  },
});
