import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { formatPrice } from "@/components/store/Price";
import { formatMarketDate } from "@/lib/catalog/format";
import { getSettings } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmingPoll } from "./confirming-poll";

// `/[locale]/order/[sessionId]` (06-checkout-orders.md step 4). Looked up by
// stripe_checkout_session_id via the admin client — orders have no anon
// select policy (0004_rls.sql), and the session id itself is the
// unguessable token that stands in for auth here. Never reveals whether a
// session id exists: an unknown id and a real one whose webhook hasn't
// landed yet render the exact same "Confirming…" state.
async function loadOrder(sessionId: string) {
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("name_snapshot");
  if (itemsError) throw itemsError;

  return { order, items: items ?? [] };
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ locale: Locale; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  const [t, result] = await Promise.all([getTranslations("order"), loadOrder(sessionId)]);

  if (!result) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
        <ConfirmingPoll />
      </main>
    );
  }

  const { order, items } = result;
  const settings = order.fulfillment === "pickup" ? await getSettings() : null;
  const pickupInstructions = settings
    ? ((locale === "fr" ? settings.pickupInstructionsFr : null) ?? settings.pickupInstructionsEn)
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="font-serif text-3xl text-ink">{t("title")}</h1>

      <ul className="mt-6 divide-y divide-ink/10">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-ink">{item.name_snapshot}</p>
              <p className="text-sm text-ink/60">
                {item.variant_label_snapshot} × {item.qty}
              </p>
              {!item.fulfilled && <p className="text-sm text-red-700">{t("soldOutRefunded")}</p>}
            </div>
            <p className="text-ink">{formatPrice(item.unit_price_cents, locale)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-1 text-ink">
        <div className="flex justify-between">
          <span>{t("subtotal")}</span>
          <span>{formatPrice(order.subtotal_cents, locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("shipping")}</span>
          <span>{formatPrice(order.shipping_cents, locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("tax")}</span>
          <span>{formatPrice(order.tax_cents, locale)}</span>
        </div>
        <div className="flex justify-between text-lg font-medium">
          <span>{t("total")}</span>
          <span>{formatPrice(order.total_cents, locale)}</span>
        </div>
      </div>

      {order.fulfillment === "pickup" ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">{t("pickup.title")}</h2>
          {settings?.marketName && <p className="mt-2 text-ink">{settings.marketName}</p>}
          {settings?.marketAddress && <p className="text-ink/70">{settings.marketAddress}</p>}
          {settings?.nextMarketDate ? (
            <p className="mt-2 text-ink/70">{t("pickup.nextDate", { date: formatMarketDate(settings.nextMarketDate, locale) })}</p>
          ) : (
            <p className="mt-2 text-ink/70">{t("pickup.fallback")}</p>
          )}
          {pickupInstructions && <p className="mt-4 text-ink/80">{pickupInstructions}</p>}
        </section>
      ) : (
        <p className="mt-8 text-ink/80">{t("ship.trackingEmail")}</p>
      )}

      <p className="mt-8 text-sm text-ink/60">{t("customerEmail", { email: order.customer_email })}</p>
    </main>
  );
}
