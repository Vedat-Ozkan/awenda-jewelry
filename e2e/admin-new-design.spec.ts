import path from "node:path";
import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";
import { cleanupLeakedTestDesigns } from "./helpers/catalog-cleanup";

// Phase 4 step 4.
const ADMIN_EMAIL = "e2e-new-design-admin@example.com";
const FIXTURE = path.join(__dirname, "..", "tests", "fixtures", "landscape-4000x3000.jpg");

test.describe("new design flow", () => {
  // Cleanup is unconditional and runs both before and after: before, so a
  // previous crashed run can never leak into this one (e.g. inflating the
  // catalog list's row count in admin-catalog.spec.ts); after, so this run
  // doesn't leak into the next one regardless of pass/fail.
  test.beforeAll(async () => {
    await cleanupLeakedTestDesigns(createServiceClient());
  });

  test.afterAll(async () => {
    await cleanupLeakedTestDesigns(createServiceClient());
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("creates, details, and publishes a design from a fixture photo", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/catalog/new");
    // Scoped to the page's own container: an unscoped getByRole("button",
    // { name: "Next" }) also matches the Next.js dev-tools overlay button.
    const form = page.getByTestId("new-design");

    await form.locator('input[type="file"]').setInputFiles(FIXTURE);
    await expect(form.getByText("Ready")).toBeVisible({ timeout: 15_000 });

    await form.getByRole("button", { name: "Next", exact: true }).click();

    await form.getByRole("button", { name: "necklace", exact: true }).click();
    await form.getByRole("button", { name: '16"', exact: true }).click();
    await form.getByRole("button", { name: '18"', exact: true }).click();
    await form.getByRole("button", { name: 'Increase 18"' }).click();

    await form.getByLabel("Name (EN)").fill("E2E Necklace");
    await form.getByLabel("Price (CAD)").fill("45");

    await form.getByRole("button", { name: "Publish" }).click();

    await expect(page).toHaveURL(/\/admin\/catalog$/);
    await expect(page.getByRole("link", { name: "E2E Necklace" })).toBeVisible();

    const supabase = createServiceClient();
    const { data: design } = await supabase
      .from("designs")
      .select("id, status, price_cents, main_image_path, thumb_image_path, embedding")
      .eq("name_en", "E2E Necklace")
      .single();
    expect(design).toBeTruthy();
    const designId = design!.id;
    expect(design!.status).toBe("active");
    expect(design!.price_cents).toBe(4500);
    expect(design!.main_image_path).toBe(`designs/${designId}/main.jpg`);
    expect(design!.thumb_image_path).toBe(`designs/${designId}/thumb.jpg`);
    expect(design!.embedding).not.toBeNull();

    const { data: variants } = await supabase
      .from("variants")
      .select("label, qty_on_hand")
      .eq("design_id", designId)
      .order("label");
    expect(variants).toHaveLength(2);
    expect(variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '16"', qty_on_hand: 1 }),
        expect.objectContaining({ label: '18"', qty_on_hand: 2 }),
      ]),
    );

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("reason")
      .eq("ref_id", designId);
    expect(movements).toHaveLength(2);
    for (const m of movements ?? []) {
      expect(m.reason).toBe("catalog");
    }
  });
});
