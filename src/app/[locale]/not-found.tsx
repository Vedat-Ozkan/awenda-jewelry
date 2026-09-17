import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Localized 404 for `notFound()` calls anywhere under `[locale]` (Phase 5
// step 10) — e.g. an unknown product slug or category. Distinct from
// src/app/global-not-found.tsx, which only catches URLs that don't match any
// route at all (no `[locale]` segment, so it can't be localized the same
// way). Renders inside the [locale] layout, so Header/Footer still show and
// the ambient next-intl locale (set by that layout) is already in scope.
export default async function LocaleNotFound() {
  const t = await getTranslations("errors");

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="font-serif text-2xl text-ink">{t("notFoundTitle")}</h1>
      <p className="text-ink/70">{t("notFoundBody")}</p>
      <Link href="/" className="underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
