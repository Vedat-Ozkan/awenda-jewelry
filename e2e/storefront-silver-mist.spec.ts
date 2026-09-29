import { expect, test } from "./fixtures";

// Silver Mist restyle of the non-home storefront pages (DECISIONS.md
// 2026-09-29): no horizontal scroll at the four target widths, and the
// restyled purchase controls still behave.

const WIDTHS = [390, 768, 1280, 1920];
const PATHS = ["/en/p/silver-ring-7", "/en/c/necklace", "/en/cart", "/en/pickup", "/en/about", "/en/policies", "/fr/p/silver-ring-7"];

for (const width of WIDTHS) {
  test(`pages fit the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PATHS) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
}

test("quantity stepper on the product page is bounded by stock and Add to bag confirms", async ({ page }) => {
  await page.goto("/en/p/hoop-earring-os"); // one size, qty 6
  const qty = page.getByLabel("Quantity", { exact: true });
  const decrease = page.getByRole("button", { name: "Decrease quantity" });
  const increase = page.getByRole("button", { name: "Increase quantity" });

  await expect(qty).toHaveValue("1");
  await expect(decrease).toBeDisabled();
  await increase.click();
  await increase.click();
  await expect(qty).toHaveValue("3");
  await qty.fill("99");
  await expect(qty).toHaveValue("6");
  await expect(increase).toBeDisabled();

  await page.getByTestId("add-to-cart").click();
  await expect(page.getByText("Added to bag")).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("6");
});

test("cart quantity stepper changes the subtotal and the last item can be removed", async ({ page }) => {
  await page.goto("/en/p/heart-pendant-os"); // $29.00
  await page.getByTestId("add-to-cart").click();
  await page.goto("/en/cart");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("$29.00");

  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByTestId("cart-subtotal")).toHaveText("$58.00");

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Your bag is empty.")).toBeVisible();
});
