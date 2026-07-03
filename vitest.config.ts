import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone from vite.config.ts on purpose — that one pulls in the
// TanStack Start / Nitro / Cloudflare build pipeline via
// @lovable.dev/vite-tanstack-config, which unit tests don't need and
// which would slow every test run down for no benefit.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
