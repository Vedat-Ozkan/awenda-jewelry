import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Figtree, Newsreader } from "next/font/google";
import "../globals.css";

// Same fonts as the storefront root layout (DECISIONS.md "Visual redesign:
// Silver Mist"); the admin restyle (a later chunk) uses them.
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

export const metadata: Metadata = {
  title: "Awenda Jewelry",
  description: "Awenda Jewelry",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "Awenda Admin",
    statusBarStyle: "default",
  },
};

// Root layout for /admin and /auth (Phase 5 step 1 route-group split — see
// DECISIONS.md "Storefront brand"/i18n scaffold): the storefront needs its
// own <html lang> + locale provider, so it gets a second root layout at
// src/app/[locale]/layout.tsx. The site-wide "Awenda Jewelry" banner that
// used to live here was for the placeholder "/" page; it's dropped since the
// admin shell (src/app/admin/(shell)/layout.tsx) already has its own header
// and /admin/login, /admin/dev/* don't need one.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
