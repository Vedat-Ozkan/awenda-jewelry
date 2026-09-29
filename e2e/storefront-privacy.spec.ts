import { expect, test } from "./fixtures";

// Phase 7 step 6: the policies page carries the analytics/privacy section in
// both locales.
for (const [locale, analyticsTitle, emailsTitle] of [
  ["en", "Visit statistics", "Your email address"],
  ["fr", "Statistiques de visite", "Votre adresse courriel"],
] as const) {
  test(`/${locale}/policies renders the privacy section`, async ({ page }) => {
    await page.goto(`/${locale}/policies`);
    const details = page.getByTestId("privacy-details");
    await expect(details.getByRole("heading", { name: analyticsTitle })).toBeVisible();
    await expect(details.getByRole("heading", { name: emailsTitle })).toBeVisible();
    await expect(details).toContainText("Cloudflare");
  });
}
