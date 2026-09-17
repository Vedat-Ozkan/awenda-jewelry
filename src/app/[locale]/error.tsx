"use client";

import { useTranslations } from "next-intl";

// Client error boundary for everything under `[locale]` (Phase 5 step 10).
// Wraps page.js/loading.js/not-found.js in this segment, but not this
// segment's own layout.tsx (node_modules/next/dist/docs/.../error.md), so
// Header/Footer and the NextIntlClientProvider they sit inside keep
// rendering — useTranslations below still has its context.
export default function LocaleError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errors");

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="font-serif text-2xl text-ink">{t("generic")}</h1>
      <button type="button" onClick={() => retry()} className="rounded-full bg-ink px-5 py-2 text-sm text-ivory">
        {t("retry")}
      </button>
    </main>
  );
}
