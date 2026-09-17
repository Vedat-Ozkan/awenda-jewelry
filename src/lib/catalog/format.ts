import type { Locale } from "@/i18n/routing";

// Formats a `date` column (YYYY-MM-DD) as the calendar date it names,
// independent of the server/browser's own timezone — next_market_date()
// (0003_functions.sql) already resolved it in the market's timezone. Moved
// here from src/app/[locale]/page.tsx (chunk A) in Phase 5 step 4 so
// PickupStrip and /pickup (step 7) can share it too.
export function formatMarketDate(isoDate: string, locale: Locale): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    dateStyle: "long",
    timeZone: "UTC",
  });
  return formatter.format(new Date(Date.UTC(year, month - 1, day)));
}

// Formats a Postgres `time` value ("09:00:00") as "9:00 a.m." — used by the
// /pickup page (step 7) for market_open_time/market_close_time.
export function formatMarketTime(time: string, locale: Locale): string {
  const [hours, minutes] = time.split(":").map(Number);
  const formatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return formatter.format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}
