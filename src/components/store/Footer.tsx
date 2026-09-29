import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LeadForm } from "./LeadForm";

// Storefront footer (Phase 5 step 3; Silver Mist redesign): one white rounded
// card — newsletter heading, links and language switch, the signup pill, and
// a small market/copyright line. Stacks on phones; heading + links sit left
// and the signup pill right from lg.
export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations("footer");
  const settings = await getSettings();

  const linkClass = "flex h-11 items-center hover:text-accent";

  return (
    <footer className="mx-auto mt-10 w-full max-w-[1360px] px-3 pb-4 md:mt-20 md:px-10 lg:pb-7">
      <div className="rounded-3xl bg-white p-6 lg:rounded-[28px] lg:p-10">
        <div className="grid gap-3.5 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-x-10 lg:gap-y-2.5">
          <p className="font-serif text-[26px] leading-tight lg:col-start-1 lg:row-start-1 lg:text-[34px]">
            {t("tagline")}
          </p>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <LeadForm kind="newsletter" />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 text-sm lg:col-start-1 lg:row-start-2">
            <nav aria-label={t("links")} className="flex flex-wrap items-center gap-x-6">
              <Link href="/policies" locale={locale} className={linkClass}>
                {t("policies")}
              </Link>
              <Link href="/pickup" locale={locale} className={linkClass}>
                {t("pickup")}
              </Link>
              <Link href="/about" locale={locale} className={linkClass}>
                {t("about")}
              </Link>
            </nav>
            <LanguageSwitcher locale={locale} />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-1 border-t border-ink/10 pt-4 text-xs text-muted">
          {(settings.marketName || settings.marketAddress) && (
            <p>{[settings.marketName, settings.marketAddress].filter(Boolean).join(" · ")}</p>
          )}
          <p>{t("rights", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
