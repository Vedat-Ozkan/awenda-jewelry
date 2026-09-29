import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { DesignViewTracker } from "@/components/store/AnalyticsTrackers";
import { LeadForm } from "@/components/store/LeadForm";
import { Gallery, type GalleryImage } from "@/components/store/Gallery";
import { formatPrice, Price } from "@/components/store/Price";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductPurchasePanel } from "@/components/store/ProductPurchasePanel";
import { HandmadeIcon, PickupIcon, ShippingIcon } from "@/components/store/TrustStrip";
import { permanentRedirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCurrentSlugFor, getDesignBySlug, getSettings, getSimilar, type DesignDetail } from "@/lib/catalog";
import { resolvePhotoUrl } from "@/lib/supabase/storage";

function toGalleryImages(design: DesignDetail): GalleryImage[] {
  const images: GalleryImage[] = [];
  if (design.main_image_path) {
    const url = resolvePhotoUrl(design.main_image_path) ?? "";
    images.push({ full: url, thumb: url });
  }
  for (const image of design.images) {
    images.push({
      full: resolvePhotoUrl(image.main_image_path) ?? "",
      thumb: resolvePhotoUrl(image.thumb_image_path) ?? "",
    });
  }
  return images;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const design = await getDesignBySlug(slug, locale);
  if (!design) return {};

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const title = `${design.name} — Awenda Jewelry`;
  // Always emit a meta description (SEO audit); fall back to a generic one
  // when the owner hasn't written product copy.
  const t = await getTranslations({ locale, namespace: "header" });
  const description = design.description ?? `${design.name} — ${t("tagline")}`;
  const mainImage = resolvePhotoUrl(design.main_image_path);

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/p/${design.slug}`,
      languages: { en: `${base}/en/p/${design.slug}`, fr: `${base}/fr/p/${design.slug}` },
    },
    // Phase 5 step 9: product-specific OG, overriding the locale layout's
    // site-wide default (src/app/[locale]/layout.tsx generateMetadata).
    openGraph: {
      type: "website",
      title,
      description,
      url: `${base}/${locale}/p/${design.slug}`,
      locale: locale === "fr" ? "fr_CA" : "en_CA",
      images: mainImage ? [mainImage] : undefined,
    },
  };
}

// `/[locale]/p/[slug]` (Phase 5 step 5; Silver Mist layout). Phone: gallery,
// purchase card, details, similar styles, stacked. From lg: gallery + details
// in the left column and the purchase card sticky in the right column (it is
// the short one, so it can stay in view while the left column scrolls).
export default async function ProductPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;

  const design = await getDesignBySlug(slug, locale);
  if (!design) {
    // 301 from a renamed design's previous_slugs before giving up to 404.
    const currentSlug = await getCurrentSlugFor(slug);
    // Guard against a self-redirect (A→B→A rename with a stale cached null).
    if (currentSlug && currentSlug !== slug) permanentRedirect({ href: `/p/${currentSlug}`, locale });
    notFound();
  }

  const [tProduct, tNav, tBadges, tMetal, settings, similar] = await Promise.all([
    getTranslations("product"),
    getTranslations("nav"),
    getTranslations("badges"),
    getTranslations("catalog.metal"),
    getSettings(),
    getSimilar(design.id, 4, locale),
  ]);

  const images = toGalleryImages(design);
  const allSoldOut = design.variants.every((v) => v.qty_on_hand <= 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: design.name,
    image: images.map((i) => i.full),
    description: design.description ?? undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "CAD",
      price: (design.price_cents / 100).toFixed(2),
      availability: design.total_qty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  const specs = [
    { label: tProduct("metal"), value: tMetal(design.metal) },
    ...(design.material ? [{ label: tProduct("material"), value: design.material }] : []),
    ...(design.dimensions ? [{ label: tProduct("dimensions"), value: design.dimensions }] : []),
  ];

  const delivery = [
    ...(settings.shippingEnabled
      ? [
          {
            key: "shipping",
            icon: <ShippingIcon />,
            text:
              settings.freeShippingThresholdCents != null
                ? tProduct("trust.shipping", { threshold: formatPrice(settings.freeShippingThresholdCents, locale) })
                : tProduct("trust.shippingFlat"),
          },
        ]
      : []),
    ...(settings.marketName
      ? [{ key: "pickup", icon: <PickupIcon />, text: tProduct("trust.pickup", { market: settings.marketName }) }]
      : []),
    { key: "returns", icon: <HandmadeIcon />, text: tProduct("trust.returns") },
  ];

  return (
    <main className="mx-auto w-full max-w-[1360px] px-3 pb-10 pt-3 md:px-10 lg:pb-20 lg:pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DesignViewTracker designId={design.id} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-x-10 lg:gap-y-6 xl:grid-cols-[minmax(0,1fr)_500px]">
        <div className="lg:col-start-1 lg:row-start-1">
          <Gallery images={images} alt={design.name} />
        </div>

        <section className="flex flex-col gap-5 rounded-3xl bg-white p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-6 lg:self-start lg:rounded-[28px] lg:p-8">
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent lg:text-[13px]">
              {tNav(design.category)}
            </p>
            <h1 className="font-serif text-[40px] leading-[1.02] font-normal tracking-[-0.02em] lg:text-[48px]">
              {design.name}
            </h1>
            <p className="text-xl font-medium">
              <Price cents={design.price_cents} locale={locale} />
            </p>
            {design.description && <p className="leading-relaxed text-muted">{design.description}</p>}
          </div>

          {allSoldOut ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-mist p-5">
              <p className="font-semibold">{tProduct("soldOutTitle")}</p>
              <p className="text-sm text-muted">{tProduct("soldOutBody")}</p>
              <section id="notify-me" className="mt-2">
                <LeadForm kind="notify" designId={design.id} />
              </section>
            </div>
          ) : (
            <ProductPurchasePanel designId={design.id} variants={design.variants} />
          )}
        </section>

        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2 lg:gap-4">
          <dl className="rounded-3xl bg-white p-6 lg:rounded-[28px] lg:p-8">
            {specs.map((spec) => (
              <div key={spec.label} className="flex items-center gap-3 py-2">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mist text-accent">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <dt className="font-medium">{spec.label}</dt>
                <dd className="text-muted">{spec.value}</dd>
              </div>
            ))}
          </dl>

          <ul className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] lg:gap-4">
            {delivery.map((item) => (
              <li key={item.key} className="flex items-center gap-3 rounded-[20px] bg-mist p-4 text-sm lg:flex-col lg:items-start lg:gap-3 lg:p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-accent">
                  {item.icon}
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="pt-10 lg:pt-20">
        <h2 className="mb-4 px-1 font-serif text-[32px] font-normal tracking-[-0.01em] lg:mb-7 lg:px-0 lg:text-[52px]">
          {tProduct("similar")}
        </h2>
        <div data-testid="similar-styles" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
          {similar.map((d) => (
            <ProductCard key={d.id} design={d} locale={locale} soldOutLabel={tBadges("soldOut")} />
          ))}
        </div>
      </section>
    </main>
  );
}
