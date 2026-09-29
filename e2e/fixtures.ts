import { test as base } from "@playwright/test";

export * from "@playwright/test";

// Every spec imports `test` from here so no e2e run talks to Cloudflare
// (the storefront layout loads the Web Analytics beacon when
// NEXT_PUBLIC_CF_BEACON_TOKEN is set — see playwright.config.ts).
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.route(/^https:\/\/([^/]+\.)?cloudflareinsights\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
    );
    await provide(context);
  },
});
