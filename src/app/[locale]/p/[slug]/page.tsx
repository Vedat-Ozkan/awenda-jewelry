import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
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

// `/[locale]/p/[slug]` (Phase 5 step 5, Nazzar/Mejuri reference: gallery
// left / details right, price + add-to-cart high on the page).
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

  const [tProduct, tNav, tBadges, settings, similar] = await Promise.all([
    getTranslations("product"),
    getTranslations("nav"),
    getTranslations("badges"),
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="grid gap-8 md:grid-cols-2">
        <Gallery images={images} alt={design.name} />

        <div>
          <p className="text-sm text-ink/60">{tNav(design.category)}</p>
          <h1 className="font-serif text-3xl text-ink">{design.name}</h1>
          <p className="mt-1 text-xl text-ink">
            <Price cents={design.price_cents} locale={locale} />
          </p>

          {design.description && <p className="mt-4 text-ink/80">{design.description}</p>}

          <div className="mt-6">
            {allSoldOut ? (
              <div>
                <p className="font-medium text-ink">{tProduct("soldOutTitle")}</p>
                <p className="text-sm text-ink/70">{tProduct("soldOutBody")}</p>
                {/* Phase 7: "Notify me when back in stock" email form goes here. */}
                <section id="notify-me" />
              </div>
            ) : (
              <ProductPurchasePanel variants={design.variants} />
            )}
          </div>

          {(design.material || design.dimensions) && (
            <dl className="mt-6 space-y-1 border-t border-gold-muted pt-4 text-sm text-ink/70">
              {design.material && (
                <div className="flex gap-2">
                  <dt className="font-medium text-ink">{tProduct("material")}</dt>
                  <dd>{design.material}</dd>
                </div>
              )}
              {design.dimensions && (
                <div className="flex gap-2">
                  <dt className="font-medium text-ink">{tProduct("dimensions")}</dt>
                  <dd>{design.dimensions}</dd>
                </div>
              )}
            </dl>
          )}

          <ul className="mt-6 space-y-2 text-sm text-ink/60">
            {settings.shippingEnabled && (
              <li className="flex items-center gap-2">
                <ShippingIcon />
                {settings.freeShippingThresholdCents != null
                  ? tProduct("trust.shipping", { threshold: formatPrice(settings.freeShippingThresholdCents, locale) })
                  : tProduct("trust.shippingFlat")}
              </li>
            )}
            {settings.marketName && (
              <li className="flex items-center gap-2">
                <PickupIcon />
                {tProduct("trust.pickup", { market: settings.marketName })}
              </li>
            )}
            <li className="flex items-center gap-2">
              <HandmadeIcon />
              {tProduct("trust.returns")}
            </li>
          </ul>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="mb-4 font-serif text-2xl text-ink">{tProduct("similar")}</h2>
        <div data-testid="similar-styles" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
          {similar.map((d) => (
            <ProductCard key={d.id} design={d} locale={locale} soldOutLabel={tBadges("soldOut")} />
          ))}
        </div>
      </section>
    </main>
  );
}
