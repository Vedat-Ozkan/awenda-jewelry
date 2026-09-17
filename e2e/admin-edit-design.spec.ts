import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";

// Phase 4 step 5. Uses the seeded "Star Pendant" design (supabase/seed.sql,
// a0000000-...-016) — not touched by any other e2e spec's fixed-name
// assertions (admin-catalog.spec.ts uses Silver Chain/Gold Chain/Heart
// Pendant/Silver Necklace/Pearl Bracelet/Silver Ring/Gold Ring). Price and
// stock are restored at the end so the suite stays idempotent without a
// `pnpm db:reset` between runs.
const ADMIN_EMAIL = "e2e-edit-design-admin@example.com";
const DESIGN_ID = "a0000000-0000-4000-8000-000000000016";
const SEEDED_PRICE_CENTS = 3400;

test.describe("edit design", () => {
  test.afterAll(async () => {
    const supabase = createServiceClient();
    await supabase.from("designs").update({ price_cents: SEEDED_PRICE_CENTS }).eq("id", DESIGN_ID);
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("edits price, restocks a variant, and shows the restock in the ledger", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto(`/admin/catalog/${DESIGN_ID}`);

    await page.getByLabel("Price (CAD)").fill("39.99");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByLabel("Price (CAD)")).toHaveValue("39.99");

    const supabase = createServiceClient();
    const { data: designAfterSave } = await supabase
      .from("designs")
      .select("price_cents")
      .eq("id", DESIGN_ID)
      .single();
    expect(designAfterSave?.price_cents).toBe(3999);

    const { data: variant } = await supabase
      .from("variants")
      .select("id, qty_on_hand")
      .eq("design_id", DESIGN_ID)
      .single();
    const qtyBefore = variant!.qty_on_hand;

    // Unique per run: the ledger is append-only, so a fixed note string
    // would collect duplicates across repeated test runs and break the
    // single-match assertion below.
    const note = `e2e restock note ${randomUUID().slice(0, 8)}`;

    await page.getByLabel(`Quantity for ${"One size"}`).fill("2");
    await page.getByLabel(`Note for ${"One size"}`).fill(note);
    await page.getByRole("button", { name: "+N restock" }).click();

    await expect(page.getByText(`One size — qty ${qtyBefore + 2}`)).toBeVisible();
    await expect(page.locator("table", { hasText: "Reason" }).getByText("restock").first()).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("delta, reason, note")
      .eq("variant_id", variant!.id)
      .eq("reason", "restock")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(movements?.[0]).toMatchObject({ delta: 2, reason: "restock", note });

    // Restore stock so this test is idempotent across repeated runs.
    await supabase.rpc("adjust_inventory", {
      p_variant_id: variant!.id,
      p_delta: -2,
      p_reason: "adjustment",
      p_note: "e2e cleanup",
    });
  });
});
