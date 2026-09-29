"use client";

import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/store/Button";

// Client error boundary for everything under `[locale]` (Phase 5 step 10).
// Wraps page.js/loading.js/not-found.js in this segment, but not this
// segment's own layout.tsx (node_modules/next/dist/docs/.../error.md), so
// Header/Footer and the NextIntlClientProvider they sit inside keep
// rendering — useTranslations below still has its context.
export default function LocaleError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errors");

  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-10 md:px-10 lg:py-20">
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-white px-6 py-14 text-center lg:rounded-[28px]">
        <h1 className="font-serif text-[32px] leading-[1.1] font-normal tracking-[-0.01em] lg:text-[40px]">
          {t("generic")}
        </h1>
        <button type="button" onClick={() => retry()} className={buttonClasses("primary", "lg")}>
          {t("retry")}
        </button>
      </div>
    </main>
  );
}
