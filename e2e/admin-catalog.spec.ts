import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";
import { cleanupLeakedTestDesigns } from "./helpers/catalog-cleanup";

// Phase 4 steps 3 and 8. Runs against supabase/seed.sql's 16 designs; tests
// run in file order (Playwright doesn't parallelize within a file by
// default) and any status change made by the bulk-ops tests is restored so
// the suite is idempotent across repeated runs without `pnpm db:reset`.
const ADMIN_EMAIL = "e2e-catalog-admin@example.com";

test.describe("admin catalog", () => {
  test.describe.configure({ mode: "serial" });

  // A crashed admin-new-design.spec.ts run can leave an "untitled"/"E2E ..."
  // design behind, which would inflate the row counts below — clean up
  // before this file's own assertions run, not just after.
  test.beforeAll(async () => {
    await cleanupLeakedTestDesigns(createServiceClient());
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/catalog");
  });

  test.afterAll(async () => {
    await cleanupLeakedTestDesigns(createServiceClient());
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("renders the seeded 16 designs", async ({ page }) => {
    const rows = page.locator("table tbody tr").filter({ hasNotText: "E2E" }).filter({ hasNotText: "Untitled" });
    await expect(rows).toHaveCount(16);
    await expect(page.getByRole("link", { name: "Silver Necklace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Heart Pendant" })).toBeVisible();
  });

  test("category filter narrows the list", async ({ page }) => {
    await page.locator('select[name="category"]').selectOption("ring");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Silver Ring" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gold Ring" })).toBeVisible();
  });

  test("search finds a seeded name", async ({ page }) => {
    await page.locator('input[name="q"]').fill("Pearl Bracelet");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Pearl Bracelet" })).toBeVisible();
  });

  test("bulk archive then activate updates status in the DB", async ({ page }) => {
    const supabase = createServiceClient();
    const names = ["Silver Chain", "Gold Chain", "Heart Pendant"];

    for (const name of names) {
      await page.getByLabel(`Select ${name}`).check();
    }
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.locator("table tbody tr", { hasText: "Silver Chain" })).toContainText("archived");

    const { data: archived } = await supabase.from("designs").select("slug, status").in("name_en", names);
    expect(archived).toHaveLength(3);
    for (const design of archived ?? []) {
      expect(design.status).toBe("archived");
    }

    // Fresh navigation rather than continuing on the same in-place
    // `router.refresh()`'d page: avoids racing that refresh's async
    // re-render (which can still be settling right as the second
    // check()/click() below run, intermittently detaching the button mid-click).
    await page.goto("/admin/catalog");

    for (const name of names) {
      await page.getByLabel(`Select ${name}`).check();
    }
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.locator("table tbody tr", { hasText: "Silver Chain" })).toContainText("active");

    const { data: activated } = await supabase.from("designs").select("status").in("name_en", names);
    for (const design of activated ?? []) {
      expect(design.status).toBe("active");
    }
  });

  test("bulk restock adds one movement per variant", async ({ page }) => {
    const supabase = createServiceClient();
    const { data: design } = await supabase
      .from("designs")
      .select("id")
      .eq("name_en", "Silver Necklace")
      .single();
    const { data: variantsBefore } = await supabase
      .from("variants")
      .select("id")
      .eq("design_id", design!.id);
    const variantIds = (variantsBefore ?? []).map((v) => v.id);

    const { count: before } = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .in("variant_id", variantIds)
      .eq("reason", "restock");

    await page.getByLabel("Select Silver Necklace").check();
    await page.getByLabel("Restock quantity").fill("1");
    await page.getByRole("button", { name: "Restock +N" }).click();
    await expect(page.getByLabel("Select Silver Necklace")).not.toBeChecked();

    const { count: after } = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .in("variant_id", variantIds)
      .eq("reason", "restock");
    expect((after ?? 0) - (before ?? 0)).toBe(variantIds.length);
  });

  test("CSV export has a header row and a seeded slug", async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Export CSV" }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("slug,name_en,category,status,price_cents,variant_label,qty_on_hand");
    expect(csv).toContain("silver-necklace-16");
  });
});
