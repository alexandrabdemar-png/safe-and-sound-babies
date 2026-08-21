// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    // Lovable's deployment environment provides both names today, but older
    // published builds can receive only the server-side variants. Explicitly
    // expose the publishable values to the browser bundle so /auth never boots
    // without its backend configuration.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env.VITE_SUPABASE_URL ||
          process.env.SUPABASE_URL ||
          // Publishable fallback so a build without env injection still boots.
          "https://vgafdyiaxzqwkeixcbcj.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYWZkeWlheHpxd2tlaXhjYmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTg3NTQsImV4cCI6MjA5NjQzNDc1NH0.ksUym7vXTtybpmvCnECumCHZQc2mxCIvOLmyKqD8W20",
      ),
      // Web Push application server key (public half of the VAPID keypair —
      // safe to ship in the browser bundle; the private half stays a backend secret).
      "import.meta.env.VITE_VAPID_PUBLIC_KEY": JSON.stringify(
        process.env.VITE_VAPID_PUBLIC_KEY ||
          process.env.VAPID_PUBLIC_KEY ||
          "BFc5K8TO0oOav0Twm7mzPnwdlxCiHsd5XzK-cpqhlSXQYZZLJU9Q94eOpOSLztEoilRH7jZe_tslQ-M8vKzxhRE",
      ),
    },

  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
