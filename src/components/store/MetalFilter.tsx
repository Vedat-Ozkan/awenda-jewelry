import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { METALS, type Metal, type Sort } from "@/lib/catalog";

// Metal filter pills for the catalog pages (`?metal=stainless_steel|
// sterling_silver`, DECISIONS.md "Structured metal on designs"). Links are
// plain server-rendered <Link>s so the filter works without JS and keeps the
// current `sort`. `basePath` is the locale-less page path ("/" or "/c/ring").
export async function MetalFilter({
  locale,
  basePath,
  active,
  sort,
}: {
  locale: Locale;
  basePath: string;
  active?: Metal;
  sort: Sort;
}) {
  const t = await getTranslations("catalog.metal");

  const href = (metal?: Metal) => {
    const params = new URLSearchParams();
    if (metal) params.set("metal", metal);
    if (sort !== "newest") params.set("sort", sort);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const pill = (isActive: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors ${
      isActive ? "bg-accent text-white" : "bg-mist text-ink hover:bg-well"
    }`;

  return (
    <nav aria-label={t("label")} className="mb-4 flex flex-wrap gap-2" data-testid="metal-filter">
      <Link href={href()} locale={locale} aria-current={!active ? "page" : undefined} className={pill(!active)}>
        {t("all")}
      </Link>
      {METALS.map((metal) => (
        <Link
          key={metal}
          href={href(metal)}
          locale={locale}
          aria-current={active === metal ? "page" : undefined}
          className={pill(active === metal)}
        >
          {t(metal)}
        </Link>
      ))}
    </nav>
  );
}
