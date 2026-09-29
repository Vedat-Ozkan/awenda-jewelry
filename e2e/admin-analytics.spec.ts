import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";

// Phase 7 step 5. Seeds a sold-out design with design_view events (timestamped
// now, so they fall in the default 30-day range) plus one lead of each kind,
// then checks the tiles, the top-designs and sold-out tables, and that both
// CSV exports start with a header row.
const ADMIN_EMAIL = "e2e-analytics-admin@example.com";
const tag = `e2e-analytics-${randomUUID().slice(0, 8)}`;
const designName = `${tag} Sold Out Ring`;
const stockEmail = `${tag}-notify@example.com`;
const newsletterEmail = `${tag}-news@example.com`;
const sessionId = `${tag}-session`;

test.describe("admin analytics", () => {
  let designId: string;

  test.beforeAll(async () => {
    const supabase = createServiceClient();

    const { data: design, error } = await supabase
      .from("designs")
      .insert({ slug: tag, category: "ring", name_en: designName, price_cents: 2500, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    designId = design.id;
    const { error: variantError } = await supabase
      .from("variants")
      .insert({ design_id: designId, label: "One size", qty_on_hand: 0 });
    if (variantError) throw variantError;

    // 15 views so the design stays inside the top-10 tables even if other
    // e2e specs have left their own events behind.
    const { error: eventsError } = await supabase.from("analytics_events").insert([
      { event: "page_view" as const, session_id: sessionId, locale: "en", path: "/en", device: "desktop" },
      ...Array.from({ length: 15 }, () => ({
        event: "design_view" as const,
        session_id: sessionId,
        locale: "en",
        design_id: designId,
        device: "desktop",
      })),
    ]);
    if (eventsError) throw eventsError;

    const { error: stockError } = await supabase
      .from("stock_notifications")
      .insert({ email: stockEmail, design_id: designId, locale: "fr" });
    if (stockError) throw stockError;
    const { error: newsletterError } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: newsletterEmail, locale: "fr" });
    if (newsletterError) throw newsletterError;
  });

  test.afterAll(async () => {
    const supabase = createServiceClient();
    await supabase.from("stock_notifications").delete().eq("email", stockEmail);
    await supabase.from("newsletter_subscribers").delete().eq("email", newsletterEmail);
    await supabase.from("analytics_events").delete().eq("session_id", sessionId);
    await supabase.from("designs").delete().eq("id", designId); // variants cascade
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("renders tiles, charts, the top and sold-out tables, and leads", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/analytics");

    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    for (const id of [
      "sessions",
      "design-views",
      "add-to-carts",
      "checkouts",
      "orders",
      "revenue",
      "conversion",
      "aov",
      "fulfillment",
    ]) {
      await expect(page.getByTestId(`tile-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId("bar-chart")).toHaveCount(3);

    await expect(page.getByTestId("table-top-designs").getByText(designName)).toBeVisible();
    await expect(page.getByTestId("table-sold-out-designs").getByText(designName)).toBeVisible();

    await expect(page.getByTestId("leads-stock").getByText(stockEmail)).toBeVisible();
    await expect(page.getByTestId("leads-newsletter").getByText(newsletterEmail)).toBeVisible();
  });

  test("range presets and a custom range update the page", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/analytics");

    await page.getByRole("link", { name: "7 days" }).click();
    await expect(page).toHaveURL(/range=7/);
    await expect(page.getByTestId("table-top-designs").getByText(designName)).toBeVisible();

    // A range entirely in the past holds none of today's seeded events.
    await page.goto("/admin/analytics?from=2020-03-02&to=2020-03-15");
    await expect(page.getByTestId("analytics-range")).toContainText("2020-03-02 to 2020-03-15");
    await expect(page.getByTestId("table-top-designs").getByText(designName)).toHaveCount(0);
  });

  test("CSV exports have a header row and include the lead", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);

    const stock = await page.request.get("/api/admin/stock-notifications.csv");
    expect(stock.status()).toBe(200);
    expect(stock.headers()["content-type"]).toContain("text/csv");
    const stockCsv = await stock.text();
    expect(stockCsv.split("\n")[0]).toBe(
      "email,design,design_slug,locale,signed_up_at,notified_at,unsubscribed_at",
    );
    expect(stockCsv).toContain(stockEmail);

    const newsletter = await page.request.get("/api/admin/newsletter.csv");
    expect(newsletter.status()).toBe(200);
    const newsletterCsv = await newsletter.text();
    expect(newsletterCsv.split("\n")[0]).toBe("email,locale,subscribed_at,unsubscribed_at");
    expect(newsletterCsv).toContain(newsletterEmail);
  });

  test("CSV exports reject signed-out requests", async ({ request }) => {
    for (const path of ["/api/admin/stock-notifications.csv", "/api/admin/newsletter.csv"]) {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    }
  });
});
