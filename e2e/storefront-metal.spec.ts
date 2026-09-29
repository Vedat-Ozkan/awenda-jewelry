import { expect, test, type Page } from "./fixtures";

// DECISIONS.md "Structured metal on designs" (2026-09-29): nav links, the home
// "All designs" filter and the steel/silver label on product cards, against
// supabase/seed.sql (`silver-*` designs are sterling silver, the rest
// stainless steel). Category-page filtering is covered by catalog-metal.spec.ts.

async function expectOnlyMetal(page: Page, metal: "silver" | "steel") {
  const cards = page.locator('#catalog a[href^="/en/p/"], #catalog a[href^="/fr/p/"]');
  await expect(cards.first()).toBeVisible();
  const hrefs = await cards.evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    if (metal === "silver") expect(href).toMatch(/\/p\/silver-/);
    else expect(href).not.toMatch(/\/p\/silver-/);
  }
}

test("desktop nav: Sterling silver and Stainless steel land on the home listing filtered by metal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  const nav = page.getByRole("banner").getByRole("navigation", { name: "Main" });

  await nav.getByRole("link", { name: "Sterling silver" }).click();
  await expect(page).toHaveURL(/\/en\?metal=sterling_silver#catalog$/);
  await expectOnlyMetal(page, "silver");

  await nav.getByRole("link", { name: "Stainless steel" }).click();
  await expect(page).toHaveURL(/\/en\?metal=stainless_steel#catalog$/);
  await expectOnlyMetal(page, "steel");
});

test("phone menu has the two metal links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  const header = page.getByRole("banner");

  await header.getByRole("button", { name: "Menu" }).click();
  await header.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sterling silver" }).click();
  await expect(page).toHaveURL(/\/en\?metal=sterling_silver#catalog$/);
  await expectOnlyMetal(page, "silver");
});

test("the All designs filter pills switch metal and keep the listing in view", async ({ page }) => {
  await page.goto("/en");
  const filter = page.getByTestId("metal-filter");

  await filter.getByRole("link", { name: "Stainless steel" }).click();
  await expect(page).toHaveURL(/\/en\?metal=stainless_steel#catalog$/);
  await expectOnlyMetal(page, "steel");
  await expect(filter.getByRole("link", { name: "Stainless steel" })).toHaveAttribute("aria-current", "page");

  await filter.getByRole("link", { name: "All metals" }).click();
  await expect(page).toHaveURL(/\/en#catalog$/);
});

test("product cards show the metal label from the structured column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/c/necklace");

  const silver = page.locator('a[href="/en/p/silver-necklace-16"]');
  await expect(silver.getByText("Sterling silver", { exact: true }).locator("visible=true")).toBeVisible();
  const steel = page.locator('a[href="/en/p/gold-necklace-20"]');
  await expect(steel.getByText("Stainless steel", { exact: true }).locator("visible=true")).toBeVisible();

  // Phone layout shows it as a line under the name instead of on the photo.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(silver.getByText("Sterling silver", { exact: true }).locator("visible=true")).toBeVisible();
});

test("the product page lists the metal in its specs", async ({ page }) => {
  await page.goto("/en/p/silver-necklace-16");
  await expect(page.getByRole("term").filter({ hasText: "Metal" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Sterling silver" })).toBeVisible();
});

test("French labels: nav link, filter pills and card label", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/fr");
  const nav = page.getByRole("banner").getByRole("navigation", { name: "Principale" });
  await expect(nav.getByRole("link", { name: "Acier inoxydable" })).toBeVisible();

  await nav.getByRole("link", { name: "Argent sterling" }).click();
  await expect(page).toHaveURL(/\/fr\?metal=sterling_silver#catalog$/);
  await expectOnlyMetal(page, "silver");

  const filter = page.getByTestId("metal-filter");
  await expect(filter.getByRole("link", { name: "Tous les métaux" })).toBeVisible();
  await expect(page.locator('#catalog a[href^="/fr/p/"]').first().getByText("Argent sterling").locator("visible=true")).toBeVisible();
});

for (const locale of ["en", "fr"] as const) {
  for (const width of [1024, 1152, 1280, 1440]) {
    test(`desktop nav does not crowd the pill at ${width}px (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/${locale}`);
      const header = page.getByRole("banner");
      const pill = (await header.locator("div").first().boundingBox())!;
      const links = header.getByRole("navigation", { name: locale === "en" ? "Main" : "Principale" }).getByRole("link");
      const boxes = [];
      for (const link of await links.all()) {
        if (await link.isVisible()) boxes.push((await link.boundingBox())!);
      }
      expect(boxes.length).toBeGreaterThanOrEqual(4);
      const rightmostLink = Math.max(...boxes.map((b) => b.x + b.width));
      const bag = (await header.locator('a[href$="/cart"]').boundingBox())!;
      const langLink = (await header.getByRole("link", { name: locale === "en" ? "FR" : "EN", exact: true }).boundingBox())!;
      // Nav ends before the language switch; nothing spills out of the pill.
      expect(rightmostLink).toBeLessThan(langLink.x);
      expect(bag.x + bag.width).toBeLessThanOrEqual(pill.x + pill.width);
    });
  }
}
