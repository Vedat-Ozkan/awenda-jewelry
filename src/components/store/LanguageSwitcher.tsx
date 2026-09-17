"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const LABELS: Record<Locale, string> = { en: "EN", fr: "FR" };

// Swaps the locale segment, keeping the rest of the path — usePathname()
// (from src/i18n/navigation.ts) returns the path with the locale prefix
// already stripped, and <Link locale=…> re-adds the target one.
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = useTranslations("header");

  return (
    <nav aria-label={t("language")} className="flex gap-2 text-sm">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          aria-current={l === locale ? "true" : undefined}
          className={l === locale ? "font-semibold text-ink" : "text-ink/60 hover:text-ink"}
        >
          {LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}
