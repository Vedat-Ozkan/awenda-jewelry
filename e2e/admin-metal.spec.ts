import path from "node:path";
import { expect, test } from "./fixtures";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";
import { cleanupLeakedTestDesigns } from "./helpers/catalog-cleanup";

// DECISIONS.md "Structured metal on designs" (2026-09-29): the metal selector
// on the New Design details screen and the edit page, and the catalog list.
const ADMIN_EMAIL = "e2e-metal-admin@example.com";
const FIXTURE = path.join(__dirname, "..", "tests", "fixtures", "landscape-4000x3000.jpg");

test.describe("design metal (admin)", () => {
  test.beforeAll(async () => {
    await cleanupLeakedTestDesigns(createServiceClient());
  });

  test.afterAll(async () => {
    await cleanupLeakedTestDesigns(createServiceClient());
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("a new design defaults to stainless steel; choosing sterling silver saves and shows in the list and edit page", async ({
    page,
  }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/catalog/new");
    const form = page.getByTestId("new-design");

    await form.locator('input[type="file"]').setInputFiles(FIXTURE);
    await expect(form.getByText("Ready")).toBeVisible({ timeout: 15_000 });
    await form.getByRole("button", { name: "Next", exact: true }).click();

    await expect(form.getByRole("button", { name: "Stainless steel", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await form.getByRole("button", { name: "Sterling silver", exact: true }).click();
    await expect(form.getByRole("button", { name: "Sterling silver", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await form.getByRole("button", { name: "necklace", exact: true }).click();
    await form.getByRole("button", { name: '16"', exact: true }).click();
    await form.getByLabel("Name (EN)").fill("E2E Metal Necklace");
    await form.getByLabel("Price (CAD)").fill("35");
    await form.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/admin\/catalog$/);

    const supabase = createServiceClient();
    const { data: design } = await supabase
      .from("designs")
      .select("id, metal")
      .eq("name_en", "E2E Metal Necklace")
      .single();
    expect(design!.metal).toBe("sterling_silver");

    // Catalog list: the row carries the metal (card layout on a phone-width
    // viewport, table on desktop; either way the label is in the row).
    await page.goto("/admin/catalog?q=E2E+Metal");
    await expect(page.getByText("Sterling silver").first()).toBeVisible();

    // Edit page: the select shows the saved metal; changing it persists.
    await page.goto(`/admin/catalog/${design!.id}`);
    const select = page.getByLabel("Metal");
    await expect(select).toHaveValue("sterling_silver");
    await select.selectOption("stainless_steel");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => (await supabase.from("designs").select("metal").eq("id", design!.id).single()).data?.metal)
      .toBe("stainless_steel");
  });
});
