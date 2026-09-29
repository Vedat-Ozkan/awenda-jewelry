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
  const tErrors = await getTranslations("errors");

  let designs: DesignCard[] = [];
  let settings: Settings | null = null;
  let dbError = false;
  try {
    [designs, settings] = await Promise.all([getDesigns({ category, metal, sort }, locale), getSettings()]);
  } catch {
    dbError = true;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      {dbError ? (
        <p className="mb-6 text-sm text-ink/70">{tErrors("dbUnreachable")}</p>
      ) : (
        settings && <PickupStrip locale={locale} settings={settings} />
      )}

      <CategoryTabs locale={locale} active={category} sort={sort} metal={metal} />
      <MetalFilter locale={locale} basePath={`/c/${category}`} active={metal} sort={sort} />
      <SortControl sort={sort} />
      <CatalogGrid designs={designs} locale={locale} />
    </main>
  );
}
