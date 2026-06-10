import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest loads this config without Cloudflare's Worker runtime, and the
// Cloudflare plugin rejects Vitest's SSR external defaults in that mode. So we
// drop it under Vitest (mirrors the Ducktype website setup). Unit tests don't
// touch the Worker entry, so SSR-only modules never enter the test graph.
const isVitest = process.env.VITEST === "true";

export default defineConfig({
  plugins: [
    ...(isVitest ? [] : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
