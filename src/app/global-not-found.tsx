import type { Metadata } from "next";
import Link from "next/link";
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

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ivory p-8 text-center text-ink">
        <h1 className="text-xl font-semibold">Page not found / Page introuvable</h1>
        <p className="text-sm text-ink/70">
          <Link href="/en" className="underline">
            Go to the shop
          </Link>{" "}
          ·{" "}
          <Link href="/fr" className="underline">
            Aller à la boutique
          </Link>
        </p>
      </body>
    </html>
  );
}
