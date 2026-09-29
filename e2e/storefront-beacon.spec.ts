import { expect, test } from "./fixtures";

// Cloudflare Web Analytics beacon (Phase 7 step 1): storefront root layout
// only, and only when NEXT_PUBLIC_CF_BEACON_TOKEN is set (playwright.config.ts
// gives the dev server a dummy token). Cloudflare requests are stubbed for
// every spec by ./fixtures.

for (const path of ["/en", "/fr/c/ring", "/en/p/hoop-earring-os"]) {
  test(`storefront page ${path} includes the beacon with the site token`, async ({ page }) => {
    await page.goto(path);
    const beacon = page.locator('script[src="https://static.cloudflareinsights.com/beacon.min.js"]');
    await expect(beacon).toHaveCount(1);
    const config = JSON.parse((await beacon.getAttribute("data-cf-beacon")) ?? "{}");
    expect(config).toEqual({ token: "e2e-beacon-token" });
  });
}

test("/admin/login never includes the beacon", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator("form")).toBeVisible();
  await expect(page.locator('script[src*="cloudflareinsights"]')).toHaveCount(0);
});
