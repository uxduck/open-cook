// Minimal typing for the Cloudflare Workers runtime module used by the server entry
// and server functions. We deliberately avoid importing the full generated
// `worker-configuration.d.ts` (via `wrangler types`) here because its workerd globals
// clash with the client's DOM lib. We only need the API service binding's fetch.
declare module "cloudflare:workers" {
  export const env: {
    API?: { fetch(request: Request): Promise<Response> };
  };
}
