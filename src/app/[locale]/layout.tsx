import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { isLocale, routing } from "@/i18n/routing";
import { CartProvider } from "@/lib/cart/CartContext";
import "../globals.css";

// Storefront root layout (Phase 5 step 1): second root layout alongside
// src/app/(admin)/layout.tsx — see docs/plan/05-storefront.md step 1 and
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md
// ("Defining multiple root layouts"). Serif heading font loaded once here
// (DECISIONS.md "Storefront brand": placeholder wordmark, serif + system
// sans) and exposed as --font-store-serif (src/app/globals.css @theme).
// display: "swap" avoids render-blocking on the font request (Phase 5 step
// 9). Weight 500 only: every `font-serif` heading across the storefront
// (Header, product/category/static page <h1>/<h2>s) uses the utility with
// no font-weight modifier, so 400 is requested and the browser's nearest-
// weight fallback resolves to the lightest loaded weight — 600/700 were
// never actually selected by any element and just cost extra font-file
// bytes for nothing.
const storeSerif = Cormorant_Garamond({
  variable: "--font-store-serif",
  subsets: ["latin"],
  weight: ["500"],
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
    manifest: "/manifest.webmanifest",
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
    <html lang={locale} className={`${storeSerif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ivory font-sans text-ink">
        <NextIntlClientProvider messages={messages}>
          <CartProvider>
            <Header locale={locale} />
            <div className="flex-1">{children}</div>
            <Footer locale={locale} />
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
