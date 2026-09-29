import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { readCapturedEmails } from "../src/lib/email/capture";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";

// Phase 7 step 4. Sold-out design created here (the seeded stud-earring-os is
// left alone so other specs keep their sold-out fixture). Submits both forms in
// FR, then restocks through the admin bulk action and checks the email
// (captured to tmp/emails when RESEND_API_KEY is unset) and notified_at.
const ADMIN_EMAIL = "e2e-leads-admin@example.com";
const prefix = `e2e-leads-${randomUUID().slice(0, 8)}`;
const notifyEmail = `${prefix}-notify@example.com`;
const newsletterEmail = `${prefix}-news@example.com`;
const designName = `E2E Leads ${prefix}`;
const slug = `${prefix}-ring`;

test.describe("lead capture", () => {
  test.describe.configure({ mode: "serial" });
  const supabase = createServiceClient();
  let designId: string;
  let variantId: string;

  test.beforeAll(async () => {
    const { data: design, error } = await supabase
      .from("designs")
      .insert({ slug, category: "ring", name_en: designName, name_fr: `${designName} FR`, price_cents: 1800, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    designId = design.id;
    const { data: variant, error: variantError } = await supabase
      .from("variants")
      .insert({ design_id: designId, label: "7", qty_on_hand: 0 })
      .select("id")
      .single();
    if (variantError) throw variantError;
    variantId = variant.id;
  });

  test.afterAll(async () => {
    await supabase.from("stock_notifications").delete().like("email", `${prefix}%`);
    await supabase.from("newsletter_subscribers").delete().like("email", `${prefix}%`);
    await supabase.from("inventory_movements").delete().eq("variant_id", variantId);
    await supabase.from("designs").delete().eq("id", designId);
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("FR: notify-me and footer newsletter forms store rows with locale 'fr'", async ({ page }) => {
    await page.goto(`/fr/p/${slug}`);

    await page.getByTestId("notify-email").fill(notifyEmail);
    await page.getByTestId("notify-submit").click();
    await expect(page.getByTestId("notify-success")).toContainText("Merci");

    await page.getByTestId("newsletter-email").fill(newsletterEmail);
    await page.getByTestId("newsletter-submit").click();
    await expect(page.getByTestId("newsletter-success")).toContainText("Merci");

    const { data: notification } = await supabase.from("stock_notifications").select("locale, design_id, notified_at").eq("email", notifyEmail).single();
    expect(notification).toMatchObject({ locale: "fr", design_id: designId, notified_at: null });
    const { data: subscriber } = await supabase.from("newsletter_subscribers").select("locale").eq("email", newsletterEmail).single();
    expect(subscriber?.locale).toBe("fr");
  });

  test("EN: a sold-out variant of an in-stock design opens the notify form and stores its variant_id", async ({ page }) => {
    const variantEmail = `${prefix}-variant@example.com`;
    // silver-ring-7 (seed): sizes 6 and 7 in stock, size 8 at 0.
    const { data: design } = await supabase.from("designs").select("id").eq("slug", "silver-ring-7").single();
    const { data: variant } = await supabase.from("variants").select("id").eq("design_id", design!.id).eq("label", "8").single();

    await page.goto("/en/p/silver-ring-7");
    await page.getByRole("button", { name: "8 — Sold out" }).click();
    await page.getByTestId("notify-email").fill(variantEmail);
    await page.getByTestId("notify-submit").click();
    await expect(page.getByTestId("notify-success")).toBeVisible();

    const { data: row } = await supabase.from("stock_notifications").select("variant_id, design_id, locale").eq("email", variantEmail).single();
    expect(row).toMatchObject({ variant_id: variant!.id, design_id: design!.id, locale: "en" });
  });

  test("admin restock emails the waiting customer in FR and sets notified_at", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/catalog");
    await page.getByLabel(`Select ${designName}`).check();
    await page.getByLabel("Restock quantity").fill("1");
    await page.getByRole("button", { name: "Restock +N" }).click();
    await expect(page.getByLabel(`Select ${designName}`)).not.toBeChecked();

    await expect
      .poll(async () => {
        const { data } = await supabase.from("stock_notifications").select("notified_at").eq("email", notifyEmail).single();
        return data?.notified_at;
      })
      .not.toBeNull();

    const email = (await readCapturedEmails()).find((e) => e.to === notifyEmail);
    expect(email).toBeTruthy();
    expect(email!.subject).toContain("est de retour");
    expect(email!.html).toContain(`/fr/p/${slug}`);
    expect(email!.html).toContain("/api/leads/unsubscribe?token=");
  });
});
