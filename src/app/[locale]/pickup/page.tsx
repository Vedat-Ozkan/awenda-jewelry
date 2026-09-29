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
    <main className="mx-auto w-full max-w-3xl px-3 pb-10 pt-6 md:px-10 lg:pb-20 lg:pt-10">
      <h1 className="mb-5 px-1 font-serif text-[40px] leading-[1.05] font-normal tracking-[-0.02em] lg:mb-8 lg:px-0 lg:text-[56px]">
        {t("title")}
      </h1>

      <div className="flex flex-col gap-3 lg:gap-4">
        <section className="flex flex-col gap-2 rounded-3xl bg-white p-6 lg:rounded-[28px] lg:p-8">
          {settings.marketName && <p className="text-xl font-medium">{settings.marketName}</p>}
          {settings.marketAddress && <p className="text-muted">{settings.marketAddress}</p>}

          {settings.marketWeekday != null && (
            <p className="text-muted">
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
        </section>

        {settings.nextMarketDate && (
          <p className="rounded-3xl bg-mist p-6 font-medium lg:rounded-[28px] lg:p-8">
            {t("nextDate", { date: formatMarketDate(settings.nextMarketDate, locale) })}
          </p>
        )}

        {instructions && <p className="rounded-3xl bg-white p-6 text-muted lg:rounded-[28px] lg:p-8">{instructions}</p>}
      </div>
    </main>
  );
}
