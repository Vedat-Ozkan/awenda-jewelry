import type { Locale } from "@/i18n/routing";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { BackInStockEmail } from "@/lib/email/templates/back-in-stock";
import { createAdminClient } from "@/lib/supabase/admin";

// Phase 7 step 4. Called by the admin restock bulk action (catalog/actions.ts
// restockDesigns) once bulk_restock() has committed. For every design that is
// active and now has stock, emails each stock_notifications row that is
// neither notified nor unsubscribed, then stamps notified_at. Best effort by
// design: the restock itself has already succeeded, so nothing here throws —
// a failed send is logged and the row is left un-notified for the next
// restock to retry. Returns the number of emails sent.
export async function sendBackInStockNotices(designIds: string[]): Promise<number> {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("stock_notifications")
    .select("id, email, locale, unsubscribe_token, design_id")
    .in("design_id", designIds)
    .is("notified_at", null)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("back-in-stock lookup failed", error.message);
    return 0;
  }
  if (!rows || rows.length === 0) return 0;

  const wantedIds = [...new Set(rows.map((r) => r.design_id))];
  const [{ data: designs }, { data: stocked }] = await Promise.all([
    admin.from("designs").select("id, slug, name_en, name_fr").eq("status", "active").in("id", wantedIds),
    admin.from("variants").select("design_id").gt("qty_on_hand", 0).in("design_id", wantedIds),
  ]);
  const inStock = new Set((stocked ?? []).map((v) => v.design_id));
  const available = new Map((designs ?? []).filter((d) => inStock.has(d.id)).map((d) => [d.id, d]));

  let sent = 0;
  for (const row of rows) {
    const design = available.get(row.design_id);
    if (!design) continue;
    const locale: Locale = row.locale === "fr" ? "fr" : "en";
    const designName = locale === "fr" ? (design.name_fr ?? design.name_en) : design.name_en;
    const siteUrl = env.NEXT_PUBLIC_SITE_URL;
    try {
      await sendEmail({
        to: row.email,
        subject: locale === "fr" ? `${designName} est de retour — Awenda Jewelry` : `${designName} is back in stock — Awenda Jewelry`,
        react: (
          <BackInStockEmail
            locale={locale}
            designName={designName}
            designUrl={`${siteUrl}/${locale}/p/${design.slug}`}
            unsubscribeUrl={`${siteUrl}/api/leads/unsubscribe?token=${row.unsubscribe_token}`}
          />
        ),
      });
      const { error: updateError } = await admin
        .from("stock_notifications")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updateError) console.error("back-in-stock notified_at update failed", updateError.message);
      sent += 1;
    } catch (err) {
      console.error("back-in-stock email failed", err instanceof Error ? err.message : err);
    }
  }
  return sent;
}
