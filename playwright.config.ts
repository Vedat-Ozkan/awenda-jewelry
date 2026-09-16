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
    },
  },
});
