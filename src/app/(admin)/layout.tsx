import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Awenda Jewelry",
  description: "Awenda Jewelry",
  manifest: "/manifest.webmanifest",
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
