import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { clearCapturedEmails, readCapturedEmails } from "../../src/lib/email/capture";
import { createServiceClient, getSupabaseEnv } from "../helpers/local-supabase";

// Phase 7 step 4: admin bulk restock -> back-in-stock emails -> notified_at.
// RESEND_API_KEY is blanked so sendEmail() takes its capture-to-tmp/emails
// path (the Resend test sender used by the other email tests).
const { API_URL, ANON_KEY } = getSupabaseEnv();
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", API_URL);
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
vi.stubEnv("RESEND_API_KEY", "");
vi.stubEnv("EMAIL_CAPTURE_SUBDIR", "emails-back-in-stock");

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));
vi.mock("@/lib/auth", () => ({
  requireAdminFromCookies: async () => ({ user: { email: "admin@example.com" }, email: "admin@example.com" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: vi.fn() }));

const { restockDesigns } = await import("@/app/(admin)/admin/(shell)/catalog/actions");

const service = createServiceClient();
const prefix = `bis-${randomUUID().slice(0, 8)}`;
const emailOf = (name: string) => `${prefix}-${name}@example.com`;
let designId: string;
let variantId: string;

describe("restockDesigns -> back-in-stock notices (real DB)", () => {
  beforeAll(async () => {
    await clearCapturedEmails();
    const { data: design, error } = await service
      .from("designs")
      .insert({ slug: `${prefix}-ring`, category: "ring", name_en: `E2E ${prefix}`, name_fr: `E2E ${prefix} FR`, price_cents: 1800, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    designId = design.id;
    const { data: variant, error: variantError } = await service
      .from("variants")
      .insert({ design_id: designId, label: "7", qty_on_hand: 0 })
      .select("id")
      .single();
    if (variantError) throw variantError;
    variantId = variant.id;

    const alreadyNotifiedAt = "2026-01-01T00:00:00.000Z";
    const { error: insertError } = await service.from("stock_notifications").insert([
      { email: emailOf("pending-en"), design_id: designId, locale: "en" },
      { email: emailOf("pending-fr"), design_id: designId, locale: "fr" },
      { email: emailOf("notified"), design_id: designId, locale: "en", notified_at: alreadyNotifiedAt },
      { email: emailOf("unsubscribed"), design_id: designId, locale: "en", unsubscribed_at: alreadyNotifiedAt },
    ]);
    if (insertError) throw insertError;
  });

  afterAll(async () => {
    await service.from("stock_notifications").delete().like("email", `${prefix}%`);
    await service.from("inventory_movements").delete().eq("variant_id", variantId);
    await service.from("designs").delete().eq("id", designId);
    await clearCapturedEmails();
  });

  it("emails only pending, subscribed rows (EN/FR), includes the unsubscribe link, sets notified_at", async () => {
    await restockDesigns([designId], 1);

    const emails = (await readCapturedEmails()).filter((e) => e.to.startsWith(prefix));
    expect(emails.map((e) => e.to).sort()).toEqual([emailOf("pending-en"), emailOf("pending-fr")]);

    const { data: rows } = await service.from("stock_notifications").select("email, notified_at, unsubscribe_token").like("email", `${prefix}%`);
    const byEmail = new Map(rows!.map((r) => [r.email, r]));

    const en = emails.find((e) => e.to === emailOf("pending-en"))!;
    const fr = emails.find((e) => e.to === emailOf("pending-fr"))!;
    expect(en.subject).toBe(`E2E ${prefix} is back in stock — Awenda Jewelry`);
    expect(fr.subject).toBe(`E2E ${prefix} FR est de retour — Awenda Jewelry`);
    expect(en.html).toContain(`/en/p/${prefix}-ring`);
    expect(fr.html).toContain(`/fr/p/${prefix}-ring`);
    expect(en.html).toContain(`/api/leads/unsubscribe?token=${byEmail.get(emailOf("pending-en"))!.unsubscribe_token}`);

    expect(byEmail.get(emailOf("pending-en"))!.notified_at).not.toBeNull();
    expect(byEmail.get(emailOf("pending-fr"))!.notified_at).not.toBeNull();
    expect(byEmail.get(emailOf("notified"))!.notified_at).toBe("2026-01-01T00:00:00+00:00");
    expect(byEmail.get(emailOf("unsubscribed"))!.notified_at).toBeNull();
  });

  it("a second restock sends nothing new", async () => {
    const before = (await readCapturedEmails()).filter((e) => e.to.startsWith(prefix)).length;
    await restockDesigns([designId], 1);
    const after = (await readCapturedEmails()).filter((e) => e.to.startsWith(prefix)).length;
    expect(after).toBe(before);
  });
});
