import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/store/Button";
import { CatalogGrid } from "@/components/store/CatalogGrid";
import { CategoryTabs } from "@/components/store/CategoryTabs";
import { MetalFilter } from "@/components/store/MetalFilter";
import { PickupStrip } from "@/components/store/PickupStrip";
import { ProductCard } from "@/components/store/ProductCard";
import { SortControl } from "@/components/store/SortControl";
import { TrustStrip } from "@/components/store/TrustStrip";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  CATEGORIES,
  getDesignBySlug,
  getDesigns,
  getSettings,
  isMetal,
  type DesignCard,
  type Metal,
  type Settings,
  type Sort,
} from "@/lib/catalog";
import { isSoldOut } from "@/lib/catalog/sort";
import { resolvePhotoUrl } from "@/lib/supabase/storage";

function parseSort(value: string | string[] | undefined): Sort {
  return value === "price_asc" || value === "price_desc" ? value : "newest";
}

function parseMetal(value: string | string[] | undefined): Metal | undefined {
  return isMetal(value) ? value : undefined;
}

// Category tile backgrounds from the Silver Mist canvas, shown until a
// category has a photo to use instead.
const TILE_TONES = ["#dadbe0", "#d2d4da", "#e0e1e5", "#cdcfd6", "#dcdde2", "#d4d6dc", "#dfe0e4", "#d6d8de"];

// Storefront home (Phase 5 step 4; Silver Mist redesign): hero with a
// floating card, category tiles, new in, trust tiles, then the full
// catalog (category tabs + sort + grid). The nav's "Shop all" link points at
// the `#catalog` anchor, "New in" at the `#new-in` section.
//
// Hero photo, tile photos and "new in" all come from data the storefront
// already has: the newest in-stock design's main image, the newest design with
// a photo per category, and the four newest in-stock designs.
//
// DB-unreachable handling (step 10): getDesigns/getSettings are wrapped in
// try/catch. A thrown Supabase error still renders the header/footer chrome,
// the hero card and a static "see you at the market" line instead of crashing.
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ sort?: string | string[]; metal?: string | string[] }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const sort = parseSort(query.sort);
  const metal = parseMetal(query.metal);

  const [tNav, tHome, tErrors, tBadges] = await Promise.all([
    getTranslations("nav"),
    getTranslations("home"),
    getTranslations("errors"),
    getTranslations("badges"),
  ]);

  let newest: DesignCard[] = [];
  let designs: DesignCard[] = [];
  let settings: Settings | null = null;
  let dbError = false;
  try {
    [newest, designs, settings] = await Promise.all([
      getDesigns({ sort: "newest" }, locale),
      getDesigns({ sort, metal }, locale),
      getSettings(),
    ]);
  } catch {
    dbError = true;
  }

  const inStock = newest.filter((d) => !isSoldOut(d));
  const newIn = inStock.slice(0, 4);

  // Hero photo: the newest in-stock design's main image (thumb as fallback).
  let heroSrc: string | null = null;
  const featured = inStock.find((d) => d.thumb_image_path);
  if (featured) {
    const detail = await getDesignBySlug(featured.slug, locale).catch(() => null);
    heroSrc = resolvePhotoUrl(detail?.main_image_path ?? featured.thumb_image_path);
  }

  const tileSrc = (category: string) =>
    resolvePhotoUrl(
      (
        inStock.find((d) => d.category === category && d.thumb_image_path) ??
        newest.find((d) => d.category === category && d.thumb_image_path)
      )?.thumb_image_path ?? null,
    );

  return (
    <main className="mx-auto w-full max-w-[1360px] px-3 md:px-10">
      <section className="mt-3 flex flex-col lg:relative lg:mt-5 lg:h-[620px] lg:flex-row lg:items-center lg:justify-end lg:p-10">
        <div className="relative h-[380px] overflow-hidden rounded-3xl bg-[#c3c5cc] lg:absolute lg:inset-0 lg:h-auto lg:rounded-[28px]">
          {heroSrc && (
            <Image
              src={heroSrc}
              alt=""
              fill
              priority
              sizes="(min-width: 1360px) 1280px, 100vw"
              className="object-cover"
            />
          )}
        </div>
        <div className="relative z-10 mx-3 -mt-[72px] flex flex-col gap-3.5 rounded-[20px] bg-white p-6 md:mx-10 lg:m-0 lg:w-[480px] lg:gap-[18px] lg:rounded-[22px] lg:bg-white/95 lg:p-9">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-accent lg:text-[13px]">
            {tHome("hero.eyebrow")}
          </span>
          <h1 className="font-serif text-[40px] leading-[1.02] font-normal tracking-[-0.02em] lg:text-[68px] lg:leading-none">
            {tHome("hero.title")}
          </h1>
          <p className="text-[15px] leading-normal text-muted lg:text-[17px] lg:leading-[1.55]">{tHome("hero.body")}</p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/#catalog" locale={locale} className={buttonClasses("primary", "lg")}>
              {tHome("hero.ctaNew")}
            </Link>
            <Link href="/pickup" locale={locale} className={`max-sm:hidden ${buttonClasses("soft", "lg")}`}>
              {tHome("hero.ctaPickup")}
            </Link>
          </div>
        </div>
      </section>

      {dbError ? (
        <p className="mt-8 rounded-2xl bg-mist px-4 py-3 text-sm">{tErrors("dbUnreachable")}</p>
      ) : (
        settings && (
          <div className="px-1 pt-4 lg:pt-6">
            <PickupStrip locale={locale} settings={settings} />
          </div>
        )
      )}

      <section aria-labelledby="home-categories" className="pt-9 lg:pt-14">
        <h2 id="home-categories" className="sr-only">
          {tHome("categories")}
        </h2>
        <ul className="grid grid-cols-4 gap-2.5 lg:grid-cols-8 lg:gap-3.5">
          {CATEGORIES.map((category, i) => {
            const src = tileSrc(category);
            return (
              <li key={category}>
                <Link
                  href={`/c/${category}`}
                  locale={locale}
                  className="flex flex-col gap-1.5 text-center text-xs font-medium lg:gap-2.5 lg:text-left lg:text-[15px]"
                >
                  <span
                    className="relative block h-20 overflow-hidden rounded-[18px] md:h-28 lg:h-32 lg:rounded-[22px]"
                    style={{
                      backgroundColor: TILE_TONES[i % TILE_TONES.length],
                    }}
                  >
                    {src && (
                      <Image src={src} alt="" fill sizes="(min-width: 1024px) 140px, 25vw" className="object-cover" />
                    )}
                  </span>
                  {tNav(category)}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {newIn.length > 0 && (
        <section id="new-in" className="scroll-mt-4 flex flex-col gap-4 pt-10 lg:gap-7 lg:pt-20">
          <div className="flex items-end justify-between px-1 lg:px-0">
            <h2 className="font-serif text-[32px] font-normal tracking-[-0.01em] lg:text-[52px]">
              {tHome("newIn")}
            </h2>
            <Link
              href="/#catalog"
              locale={locale}
              className="flex h-11 items-center text-sm font-semibold underline underline-offset-4 hover:text-accent lg:text-[15px] lg:underline-offset-6"
            >
              {tHome("cta")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
            {newIn.map((design) => (
              <ProductCard key={design.id} design={design} locale={locale} soldOutLabel={tBadges("soldOut")} />
            ))}
          </div>
        </section>
      )}

      <section id="catalog" className="scroll-mt-4 pt-10 lg:pt-20">
        <h2 className="mb-4 px-1 font-serif text-[32px] font-normal tracking-[-0.01em] lg:mb-7 lg:px-0 lg:text-[52px]">
          {tHome("allDesigns")}
        </h2>
        <CategoryTabs locale={locale} sort={sort} metal={metal} />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:mb-7">
          <MetalFilter locale={locale} basePath="/" active={metal} sort={sort} hash="catalog" />
          <SortControl sort={sort} />
        </div>
        <CatalogGrid designs={designs} locale={locale} />
      </section>

      {settings && (
        <section className="mt-10 lg:mt-20">
          <TrustStrip locale={locale} settings={settings} />
        </section>
      )}
    </main>
  );
}
