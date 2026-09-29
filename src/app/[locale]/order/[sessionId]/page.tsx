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

  const shell = "mx-auto w-full max-w-3xl px-3 pb-10 pt-6 md:px-10 lg:pb-20 lg:pt-10";

  if (!result) {
    return (
      <main className={shell}>
        <div className="rounded-3xl bg-white px-6 py-14 text-center">
          <ConfirmingPoll />
        </div>
      </main>
    );
  }

  const { order, items } = result;
  const settings = order.fulfillment === "pickup" ? await getSettings() : null;
  const pickupInstructions = settings
    ? ((locale === "fr" ? settings.pickupInstructionsFr : null) ?? settings.pickupInstructionsEn)
    : null;

  return (
    <main className={shell}>
      <h1 className="mb-5 px-1 font-serif text-[40px] leading-[1.05] font-normal tracking-[-0.02em] lg:mb-8 lg:px-0 lg:text-[56px]">
        {t("title")}
      </h1>

      <div className="flex flex-col gap-3 lg:gap-4">
        <section className="rounded-3xl bg-white p-5 lg:rounded-[28px] lg:p-8">
          <ul className="divide-y divide-ink/10">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <div>
                  <p className="font-medium">{item.name_snapshot}</p>
                  <p className="text-sm text-muted">
                    {item.variant_label_snapshot} × {item.qty}
                  </p>
                  {!item.fulfilled && <p className="text-sm text-red-700">{t("soldOutRefunded")}</p>}
                </div>
                <p className="shrink-0 font-medium">{formatPrice(item.unit_price_cents, locale)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-col gap-2 border-t border-ink/10 pt-5">
            <div className="flex justify-between text-muted">
              <span>{t("subtotal")}</span>
              <span>{formatPrice(order.subtotal_cents, locale)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>{t("shipping")}</span>
              <span>{formatPrice(order.shipping_cents, locale)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>{t("tax")}</span>
              <span>{formatPrice(order.tax_cents, locale)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>{t("total")}</span>
              <span>{formatPrice(order.total_cents, locale)}</span>
            </div>
          </div>
        </section>

        {order.fulfillment === "pickup" ? (
          <section className="rounded-3xl bg-mist p-5 lg:rounded-[28px] lg:p-8">
            <h2 className="mb-3 font-serif text-[28px] font-normal tracking-[-0.01em]">{t("pickup.title")}</h2>
            {settings?.marketName && <p className="font-medium">{settings.marketName}</p>}
            {settings?.marketAddress && <p className="text-muted">{settings.marketAddress}</p>}
            {settings?.nextMarketDate ? (
              <p className="mt-2">{t("pickup.nextDate", { date: formatMarketDate(settings.nextMarketDate, locale) })}</p>
            ) : (
              <p className="mt-2">{t("pickup.fallback")}</p>
            )}
            {pickupInstructions && <p className="mt-4 text-muted">{pickupInstructions}</p>}
          </section>
        ) : (
          <p className="rounded-3xl bg-mist p-5 lg:rounded-[28px] lg:p-8">{t("ship.trackingEmail")}</p>
        )}
      </div>

      <p className="mt-6 px-1 text-sm text-muted lg:px-0">{t("customerEmail", { email: order.customer_email })}</p>
    </main>
  );
}
