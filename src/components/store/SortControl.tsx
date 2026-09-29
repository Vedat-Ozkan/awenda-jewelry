"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {t("label")}
      <select
        value={sort}
        onChange={(e) => {
          const value = e.target.value as Sort;
          // Keep the other params (e.g. `?metal=`) when switching sort.
          const params = new URLSearchParams(searchParams);
          if (value === "newest") params.delete("sort");
          else params.set("sort", value);
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
        className="h-11 appearance-none rounded-full bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%231e1f24%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[position:right_16px_center] bg-no-repeat pl-4 pr-10 text-sm font-medium text-ink"
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
