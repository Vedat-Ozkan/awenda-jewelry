import { expect, test } from "./fixtures";
import { createServiceClient } from "../tests/helpers/local-supabase";

// Phase 7 step 3. Browse home -> product -> add to cart; the funnel events
// land in analytics_events, all sharing the tab's one session id.
test("home -> product -> add to cart records page_view, design_view and add_to_cart under one session", async ({
  page,
}) => {
  const supabase = createServiceClient();
  const since = new Date().toISOString();

  await page.goto("/en");
  await page.locator('#catalog a[href="/en/p/hoop-earring-os"]').click();
  await expect(page).toHaveURL(/\/en\/p\/hoop-earring-os/);
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  const sessionId = await page.evaluate(() => sessionStorage.getItem("awenda-session"));
  expect(sessionId).toBeTruthy();

  await expect
    .poll(
      async () => {
        const { data } = await supabase
          .from("analytics_events")
          .select("event")
          .eq("session_id", sessionId!)
          .gte("occurred_at", since);
        return new Set(data?.map((row) => row.event));
      },
      { timeout: 10_000 },
    )
    .toEqual(new Set(["page_view", "design_view", "add_to_cart"]));

  const { data: rows } = await supabase.from("analytics_events").select("event, design_id, variant_id").eq("session_id", sessionId!);
  expect(rows!.find((row) => row.event === "add_to_cart")).toMatchObject({
    design_id: expect.any(String),
    variant_id: expect.any(String),
  });

  await supabase.from("analytics_events").delete().eq("session_id", sessionId!);
});
