import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { createServiceClient, getSupabaseEnv } from "../helpers/local-supabase";

// Phase 7 step 4. Real-DB coverage of the three lead routes; the route
// modules' validation branches are unit-tested next to each route.
const { API_URL, ANON_KEY } = getSupabaseEnv();
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", API_URL);
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));
// See checkout-route.test.ts for why next-intl/server is stood in for.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "en" | "fr"; namespace: string }) => {
    const ns = namespace.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], locale === "fr" ? fr : en);
    return (key: string) => (ns as Record<string, string>)[key] ?? key;
  },
}));

const { POST: notify } = await import("@/app/api/leads/notify/route");
const { POST: newsletter } = await import("@/app/api/leads/newsletter/route");
const { GET: unsubscribe } = await import("@/app/api/leads/unsubscribe/route");

const service = createServiceClient();
const prefix = `leads-${randomUUID().slice(0, 8)}`;
const notifyEmail = `${prefix}-notify@example.com`;
const newsletterEmail = `${prefix}-news@example.com`;
let designId: string;

function post(handler: (r: Request) => Promise<Response>, path: string, body: unknown) {
  return handler(
    new Request(`http://localhost/api/leads/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("lead routes (real DB)", () => {
  beforeAll(async () => {
    const { data, error } = await service
      .from("designs")
      .insert({ slug: `${prefix}-ring`, category: "ring", name_en: `E2E ${prefix}`, price_cents: 1800, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    designId = data.id;
  });

  afterAll(async () => {
    await service.from("stock_notifications").delete().like("email", `${prefix}%`);
    await service.from("newsletter_subscribers").delete().like("email", `${prefix}%`);
    await service.from("designs").delete().eq("id", designId);
  });

  it("notify: stores locale, dedupes on (email, design), and re-arms a notified/unsubscribed row", async () => {
    expect((await post(notify, "notify", { email: notifyEmail, locale: "fr", designId })).status).toBe(204);
    expect((await post(notify, "notify", { email: notifyEmail.toUpperCase(), locale: "fr", designId })).status).toBe(204);

    const { data: rows } = await service.from("stock_notifications").select("*").eq("email", notifyEmail);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ locale: "fr", design_id: designId, notified_at: null, unsubscribed_at: null });
    const token = rows![0].unsubscribe_token;

    await service
      .from("stock_notifications")
      .update({ notified_at: new Date().toISOString(), unsubscribed_at: new Date().toISOString() })
      .eq("id", rows![0].id);
    expect((await post(notify, "notify", { email: notifyEmail, locale: "en", designId })).status).toBe(204);

    const { data: again } = await service.from("stock_notifications").select("*").eq("email", notifyEmail);
    expect(again).toHaveLength(1);
    expect(again![0]).toMatchObject({ locale: "en", notified_at: null, unsubscribed_at: null, unsubscribe_token: token });
  });

  it("notify: unknown design -> 400 and no row; honeypot -> 204 and no row", async () => {
    const ghost = `${prefix}-ghost@example.com`;
    expect((await post(notify, "notify", { email: ghost, locale: "en", designId: randomUUID() })).status).toBe(400);
    expect((await post(notify, "notify", { email: ghost, locale: "en", designId, website: "spam" })).status).toBe(204);
    const { count } = await service.from("stock_notifications").select("id", { count: "exact", head: true }).eq("email", ghost);
    expect(count).toBe(0);
  });

  it("newsletter: stores locale, dedupes, and a repeat signup clears unsubscribed_at", async () => {
    expect((await post(newsletter, "newsletter", { email: newsletterEmail, locale: "fr" })).status).toBe(204);
    expect((await post(newsletter, "newsletter", { email: newsletterEmail, locale: "fr" })).status).toBe(204);
    const { data: rows } = await service.from("newsletter_subscribers").select("*").eq("email", newsletterEmail);
    expect(rows).toHaveLength(1);
    expect(rows![0].locale).toBe("fr");

    await service.from("newsletter_subscribers").update({ unsubscribed_at: new Date().toISOString() }).eq("id", rows![0].id);
    expect((await post(newsletter, "newsletter", { email: newsletterEmail, locale: "fr" })).status).toBe(204);
    const { data: after } = await service.from("newsletter_subscribers").select("unsubscribed_at").eq("email", newsletterEmail).single();
    expect(after!.unsubscribed_at).toBeNull();
  });

  it("unsubscribe: both token kinds set unsubscribed_at and render the row's locale; unknown token is 404", async () => {
    const { data: notification } = await service.from("stock_notifications").select("unsubscribe_token").eq("email", notifyEmail).single();
    const { data: subscriber } = await service.from("newsletter_subscribers").select("unsubscribe_token").eq("email", newsletterEmail).single();
    const url = (token: string) => new Request(`http://localhost/api/leads/unsubscribe?token=${token}`);

    const notificationRes = await unsubscribe(url(notification!.unsubscribe_token));
    expect(notificationRes.status).toBe(200);
    expect(await notificationRes.text()).toContain('<html lang="en">'); // re-armed above with locale en
    const subscriberRes = await unsubscribe(url(subscriber!.unsubscribe_token));
    expect(await subscriberRes.text()).toContain('<html lang="fr">');

    const { data: n } = await service.from("stock_notifications").select("unsubscribed_at").eq("email", notifyEmail).single();
    const { data: s } = await service.from("newsletter_subscribers").select("unsubscribed_at").eq("email", newsletterEmail).single();
    expect(n!.unsubscribed_at).not.toBeNull();
    expect(s!.unsubscribed_at).not.toBeNull();

    expect((await unsubscribe(url(randomUUID()))).status).toBe(404);
  });
});
