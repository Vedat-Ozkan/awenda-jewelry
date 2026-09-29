import type { Metadata } from "next";
import { Figtree, Newsreader } from "next/font/google";
import Link from "next/link";
import { buttonClasses } from "@/components/store/Button";
import "./globals.css";

// Global 404 for URLs that don't match any route at all (Next 16, opt-in via
// experimental.globalNotFound in next.config.ts) — needed because this app
// has two root layouts (src/app/(admin)/layout.tsx and
// src/app/[locale]/layout.tsx), so there's no single layout to compose a
// normal app/not-found.tsx from. Bypasses every layout, so it imports its
// own styles/fonts and renders a full <html>/<body> document. Kept plain
// English/French side by side rather than pulling in next-intl, since a
// request that reaches here has no matched `[locale]` segment to read.
export const metadata: Metadata = {
  title: "Not found — Awenda Jewelry",
};

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], axes: ["opsz"], display: "swap" });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${newsreader.variable} ${figtree.variable} antialiased`}>
      <body className="flex min-h-screen items-center justify-center bg-page p-3 font-sans text-ink">
        <main className="flex w-full max-w-lg flex-col items-center gap-5 rounded-3xl bg-white px-6 py-14 text-center">
          <h1 className="font-serif text-[32px] leading-[1.1] font-normal tracking-[-0.01em]">
            Page not found / Page introuvable
          </h1>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/en" className={buttonClasses("primary", "lg")}>
              Go to the shop
            </Link>
            <Link href="/fr" className={buttonClasses("soft", "lg")}>
              Aller à la boutique
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
