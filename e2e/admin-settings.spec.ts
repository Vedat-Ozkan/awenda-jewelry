import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";

// Phase 4 step 9.
const ADMIN_EMAIL = "e2e-settings-admin@example.com";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test.describe("admin settings", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    // Restore the seeded row (supabase/seed.sql): shipping rate and closed-until.
    const supabase = createServiceClient();
    await supabase.from("settings").update({ shipping_flat_cents: 500, market_closed_until: null }).eq("id", 1);
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("saves a changed shipping rate", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/settings");

    await page.getByLabel(/Flat shipping rate/).fill("7");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const supabase = createServiceClient();
    const { data } = await supabase.from("settings").select("shipping_flat_cents").eq("id", 1).single();
    expect(data?.shipping_flat_cents).toBe(700);

    await page.reload();
    await expect(page.getByLabel(/Flat shipping rate/)).toHaveValue("7");
  });

  test("closing the market until the next market date moves it a week later", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/settings");

    const before = await page.getByText(/Next market date:/).textContent();
    const beforeDate = before!.match(/(\d{4}-\d{2}-\d{2})/)![1];

    await page.getByLabel("Closed until").fill(beforeDate);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    const after = await page.getByText(/Next market date:/).textContent();
    const afterDate = after!.match(/(\d{4}-\d{2}-\d{2})/)![1];

    expect(afterDate).toBe(addDays(beforeDate, 7));
  });
});
