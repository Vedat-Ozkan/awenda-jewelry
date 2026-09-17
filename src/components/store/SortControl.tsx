"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Sort } from "@/lib/catalog";

const OPTIONS: { value: Sort; labelKey: "newest" | "priceAsc" | "priceDesc" }[] = [
  { value: "newest", labelKey: "newest" },
  { value: "price_asc", labelKey: "priceAsc" },
  { value: "price_desc", labelKey: "priceDesc" },
];

// Sort control (Phase 5 step 4, `?sort=`). usePathname() already strips the
// locale prefix (src/i18n/navigation.ts), so it doubles as the category vs.
// home base path. router.replace (not push) keeps switching sort out of
// browser history.
export function SortControl({ sort }: { sort: Sort }) {
  const t = useTranslations("catalog.sort");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="mb-6 flex items-center gap-2 text-sm text-ink/70">
      {t("label")}
      <select
        value={sort}
        onChange={(e) => {
          const value = e.target.value as Sort;
          router.replace(value === "newest" ? pathname : `${pathname}?sort=${value}`);
        }}
        className="rounded border border-ink/20 bg-ivory px-2 py-1 text-ink"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
