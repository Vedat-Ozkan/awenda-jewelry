import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Storefront footer (Phase 5 step 3): market info from settings, language
// switch, policy links. `/policies`, `/pickup`, `/about` don't exist until
// step 7 (a later chunk) — they 404 for now, which the phase file calls out
// as acceptable at this stage.
export async function Footer({ locale }: { locale: Locale }) {
  const [t, tHeader] = await Promise.all([getTranslations("footer"), getTranslations("header")]);
  const settings = await getSettings();

  return (
    <footer className="border-t border-gold-muted bg-gold-muted/30 px-4 py-8 text-sm md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <p className="font-serif text-lg text-ink">{tHeader("wordmark")}</p>
        {settings.marketName && <p className="text-ink/70">{settings.marketName}</p>}
        {settings.marketAddress && <p className="text-ink/70">{settings.marketAddress}</p>}
        <nav className="flex flex-wrap gap-4">
          <Link href="/policies" locale={locale} className="text-ink/80 hover:text-ink">
            {t("policies")}
          </Link>
          <Link href="/pickup" locale={locale} className="text-ink/80 hover:text-ink">
            {t("pickup")}
          </Link>
          <Link href="/about" locale={locale} className="text-ink/80 hover:text-ink">
            {t("about")}
          </Link>
        </nav>
        <LanguageSwitcher locale={locale} />
        <p className="text-xs text-ink/50">{t("rights", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
