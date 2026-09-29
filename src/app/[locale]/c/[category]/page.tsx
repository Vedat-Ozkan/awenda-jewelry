import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CatalogGrid } from "@/components/store/CatalogGrid";
import { CategoryTabs } from "@/components/store/CategoryTabs";
import { MetalFilter } from "@/components/store/MetalFilter";
import { PickupStrip } from "@/components/store/PickupStrip";
import { SortControl } from "@/components/store/SortControl";
import type { Locale } from "@/i18n/routing";
import {
  getDesigns,
  getSettings,
  isCategory,
  isMetal,
  type DesignCard,
  type Metal,
  type Settings,
  type Sort,
} from "@/lib/catalog";

function parseSort(value: string | string[] | undefined): Sort {
  return value === "price_asc" || value === "price_desc" ? value : "newest";
}

function parseMetal(value: string | string[] | undefined): Metal | undefined {
  return isMetal(value) ? value : undefined;
}

// `/[locale]/c/[category]` (Phase 5 step 4): the same catalog components as
// the home page, filtered to one category. Unknown category -> notFound().
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; category: string }>;
  searchParams: Promise<{ sort?: string | string[]; metal?: string | string[] }>;
}) {
  const { locale, category } = await params;
  if (!isCategory(category)) notFound();

  const query = await searchParams;
  const sort = parseSort(query.sort);
  const metal = parseMetal(query.metal);
  const [tErrors, tNav] = await Promise.all([getTranslations("errors"), getTranslations("nav")]);

  let designs: DesignCard[] = [];
  let settings: Settings | null = null;
  let dbError = false;
  try {
    [designs, settings] = await Promise.all([getDesigns({ category, metal, sort }, locale), getSettings()]);
  } catch {
    dbError = true;
  }

  return (
    <main className="mx-auto w-full max-w-[1360px] px-3 pb-10 pt-6 md:px-10 lg:pb-20 lg:pt-10">
      <h1 className="mb-4 px-1 font-serif text-[40px] leading-[1.05] font-normal tracking-[-0.02em] lg:mb-6 lg:px-0 lg:text-[64px]">
        {tNav(category)}
      </h1>

      {dbError ? (
        <p className="mb-5 rounded-2xl bg-mist px-4 py-3 text-sm">{tErrors("dbUnreachable")}</p>
      ) : (
        settings && (
          <div className="mb-5 px-1 lg:mb-7 lg:px-0">
            <PickupStrip locale={locale} settings={settings} />
          </div>
        )
      )}

      <CategoryTabs locale={locale} active={category} sort={sort} metal={metal} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:mb-7">
        <MetalFilter locale={locale} basePath={`/c/${category}`} active={metal} sort={sort} />
        <SortControl sort={sort} />
      </div>
      <CatalogGrid designs={designs} locale={locale} />
    </main>
  );
}
