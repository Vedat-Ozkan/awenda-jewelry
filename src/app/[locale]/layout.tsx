import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Figtree, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { PageViewTracker } from "@/components/store/AnalyticsTrackers";
import { isLocale, routing } from "@/i18n/routing";
import { CartProvider } from "@/lib/cart/CartContext";
import "../globals.css";

// Storefront root layout (Phase 5 step 1): second root layout alongside
// src/app/(admin)/layout.tsx — see docs/plan/05-storefront.md step 1 and
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md
// ("Defining multiple root layouts"). Fonts (DECISIONS.md "Visual redesign:
// Silver Mist"): Newsreader for whole headings and the wordmark, Figtree for
// everything else; exposed as --font-newsreader / --font-figtree
// (src/app/globals.css @theme). display: "swap" avoids render-blocking on the
// font request (Phase 5 step 9). Newsreader's optical-size axis lets the
// browser pick the right cut per size, as the design canvas does. `axes` needs
// the variable font, so no `weight` list: the page uses 400 and 500.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Renders every storefront route on request rather than prerendering it at
// build time. `next build` runs with no Supabase available (CI, the
// Cloudflare deploy build) — a static/ISR `/[locale]` would call
// getDesigns()/getSettings() during the build's static-generation pass and
// fail (confirmed locally: prerendering /en without local Supabase running
// throws a fetch-connect error). Data itself still caches via
// unstable_cache (tag "catalog", revalidate: 60 — src/lib/catalog/index.ts);
// this only turns off *route* prerendering. Applies to the whole subtree
// (every page under this layout), so no other file needs this export.
// Deliberately no generateStaticParams() here: pre-listing the locales
// would just get Next to try prerendering them again.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const title = "Awenda Jewelry";
  const description = "Handmade jewelry, sold online and at the weekly market.";

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}`])),
    },
    // Site-wide default (Phase 5 step 9) — product pages (p/[slug]/page.tsx)
    // set their own openGraph with a product image; everything else
    // (home, category, static pages) falls back to this.
    openGraph: {
      type: "website",
      siteName: title,
      title,
      description,
      url: `${base}/${locale}`,
      locale: locale === "fr" ? "fr_CA" : "en_CA",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Enables static rendering for this locale — see next-intl's server docs
  // (node_modules/next-intl/dist/types/server/react-server/index.d.ts
  // exports `setRequestLocale`).
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${newsreader.variable} ${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-page font-sans text-ink">
        <NextIntlClientProvider messages={messages}>
          <CartProvider>
            <PageViewTracker />
            <AnnouncementBar />
            <Header locale={locale} />
            <div className="flex-1">{children}</div>
            <Footer locale={locale} />
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
