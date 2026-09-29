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
    <nav aria-label={t("language")} className="flex items-center text-[15px]">
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
          )}
          <Link
            href={pathname}
            locale={l}
            aria-current={l === locale ? "true" : undefined}
            className={`flex h-11 min-w-11 items-center justify-center px-1.5 ${l === locale ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
          >
            {LABELS[l]}
          </Link>
        </span>
      ))}
    </nav>
  );
}
