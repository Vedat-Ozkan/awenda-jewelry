import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { formatMarketDate, formatMarketTime } from "@/lib/catalog/format";

// Market name/address/weekday/hours/next date + pickup_instructions_en/fr
// from settings (docs/plan/05-storefront.md step 7). Real market details are
// still placeholders (DECISIONS.md "Market details: placeholders until
// Phase 9") — this page just renders whatever settings holds.
export default async function PickupPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [t, settings] = await Promise.all([getTranslations("pages.pickup"), getSettings()]);

  const instructions = (locale === "fr" ? settings.pickupInstructionsFr : null) ?? settings.pickupInstructionsEn;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="font-serif text-3xl text-ink">{t("title")}</h1>

      {settings.marketName && <p className="mt-4 text-ink">{settings.marketName}</p>}
      {settings.marketAddress && <p className="text-ink/70">{settings.marketAddress}</p>}

      {settings.marketWeekday != null && (
        <p className="mt-2 text-ink/70">
          {t("weekday", { weekday: t(`weekdays.${settings.marketWeekday}`) })}
          {settings.marketOpenTime && settings.marketCloseTime && (
            <>
              {" "}
              ·{" "}
              {t("hours", {
                open: formatMarketTime(settings.marketOpenTime, locale),
                close: formatMarketTime(settings.marketCloseTime, locale),
              })}
            </>
          )}
        </p>
      )}

      {settings.nextMarketDate && (
        <p className="mt-2 text-ink/70">{t("nextDate", { date: formatMarketDate(settings.nextMarketDate, locale) })}</p>
      )}

      {instructions && <p className="mt-6 text-ink/80">{instructions}</p>}
    </main>
  );
}
