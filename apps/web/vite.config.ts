import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest loads this config without Cloudflare's Worker runtime, and the
// Cloudflare plugin rejects Vitest's SSR external defaults in that mode. So we
// drop it under Vitest (mirrors the Ducktype website setup). Unit tests don't
// touch the Worker entry, so SSR-only modules never enter the test graph.
const isVitest = process.env.VITEST === "true";
const isVercel =
  process.env.OPEN_COOK_DEPLOY_TARGET === "vercel" || process.env.VERCEL === "1";
const cloudflareWorkersShim = fileURLToPath(
  new URL("./src/server/noopCloudflareWorkers.ts", import.meta.url),
);

export default defineConfig({
  plugins: [
    ...(isVitest || isVercel
      ? []
      : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    tanstackStart(),
    ...(isVercel ? [nitro({ preset: "vercel" })] : []),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: isVercel ? { "cloudflare:workers": cloudflareWorkersShim } : {},
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
