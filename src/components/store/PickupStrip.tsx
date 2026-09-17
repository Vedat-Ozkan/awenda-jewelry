import { getTranslations } from "next-intl/server";
import { formatMarketDate } from "@/lib/catalog/format";
import type { Locale } from "@/i18n/routing";
import type { Settings } from "@/lib/catalog";

// "Next pickup: <date> at <market>" strip (kept from chunk A's step 3
// skeleton), or the closed note when `market_closed_until` is in the future
// (Phase 5 step 4). Shared by the home page and `/c/[category]`.
export async function PickupStrip({ locale, settings }: { locale: Locale; settings: Settings }) {
  const t = await getTranslations("home");

  const closedUntil = settings.marketClosedUntil;
  const isClosed = closedUntil != null && new Date(closedUntil) > new Date();

  if (isClosed) {
    const note = locale === "fr" ? settings.marketClosedNoteFr : settings.marketClosedNoteEn;
    return (
      <p className="mb-6 text-sm text-ink/70">
        {t("marketClosed", { date: formatMarketDate(closedUntil, locale) })}
        {note ? ` ${note}` : ""}
      </p>
    );
  }

  if (!settings.nextMarketDate || !settings.marketName) return null;

  return (
    <p className="mb-6 text-sm text-ink/70">
      {t("nextPickup", { date: formatMarketDate(settings.nextMarketDate, locale), market: settings.marketName })}
    </p>
  );
}
