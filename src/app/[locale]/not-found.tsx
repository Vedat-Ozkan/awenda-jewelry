import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/store/Button";
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
    <main className="mx-auto w-full max-w-3xl px-3 py-10 md:px-10 lg:py-20">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-14 text-center lg:rounded-[28px]">
        <h1 className="font-serif text-[32px] leading-[1.1] font-normal tracking-[-0.01em] lg:text-[40px]">
          {t("notFoundTitle")}
        </h1>
        <p className="mb-2 text-muted">{t("notFoundBody")}</p>
        <Link href="/" className={buttonClasses("primary", "lg")}>
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
