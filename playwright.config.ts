import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      EMBEDDINGS_PROVIDER: "fake",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      CRON_SECRET: "test-secret",
      // Local Supabase (`pnpm supabase start`) always serves on this port
      // with this anon key — it's the fixed CLI demo JWT (see
      // supabase/config.toml `[api] port = 54321`; the key itself comes
      // from the CLI's baked-in demo JWT_SECRET, not a project secret), the
      // same value tests/helpers/local-supabase.ts reads from `supabase
      // status -o env`. Hardcoded rather than shelled out at config-load
      // time so `pnpm e2e` doesn't depend on the CLI being resolvable then.
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
    },
  },
});
