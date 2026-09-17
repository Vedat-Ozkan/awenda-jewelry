import { getTranslations } from "next-intl/server";
import { CatalogGrid } from "@/components/store/CatalogGrid";
import { CategoryTabs } from "@/components/store/CategoryTabs";
import { PickupStrip } from "@/components/store/PickupStrip";
import { SortControl } from "@/components/store/SortControl";
import { TrustStrip } from "@/components/store/TrustStrip";
import type { Locale } from "@/i18n/routing";
import { getDesigns, getSettings, type DesignCard, type Settings, type Sort } from "@/lib/catalog";

function parseSort(value: string | string[] | undefined): Sort {
  return value === "price_asc" || value === "price_desc" ? value : "newest";
}

// Storefront home (Phase 5 step 4 — extends chunk A's skeleton: a short
// hero, the settings-driven trust strip, category tabs, a sort control, and
// hands the grid itself to CatalogGrid, which also owns the sold-out
// partition and the empty-state message).
//
// DB-unreachable handling (step 10): getDesigns/getSettings are wrapped in
// try/catch. A thrown Supabase error still renders the header/footer chrome
// and a static "see you at the market" line instead of crashing the page.
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ sort?: string | string[] }>;
}) {
  const { locale } = await params;
  const sort = parseSort((await searchParams).sort);

  const [tHeader, tHome, tErrors] = await Promise.all([
    getTranslations("header"),
    getTranslations("home"),
    getTranslations("errors"),
  ]);

  let designs: DesignCard[] = [];
  let settings: Settings | null = null;
  let dbError = false;
  try {
    [designs, settings] = await Promise.all([getDesigns({ sort }, locale), getSettings()]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <section className="bg-gradient-to-b from-gold-muted/40 to-ivory px-4 py-12 text-center md:py-20">
        <h1 className="font-serif text-4xl text-ink md:text-6xl">{tHeader("wordmark")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink/70 md:text-lg">{tHeader("tagline")}</p>
        <a
          href="#catalog"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-gold-deep"
        >
          {tHome("cta")}
        </a>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {dbError ? (
          <p className="mb-6 text-sm text-ink/70">{tErrors("dbUnreachable")}</p>
        ) : (
          settings && (
            <>
              <TrustStrip locale={locale} settings={settings} />
              <PickupStrip locale={locale} settings={settings} />
            </>
          )
        )}

        <div id="catalog">
          <CategoryTabs locale={locale} sort={sort} />
          <SortControl sort={sort} />
          <CatalogGrid designs={designs} locale={locale} />
        </div>
      </main>
    </>
  );
}
