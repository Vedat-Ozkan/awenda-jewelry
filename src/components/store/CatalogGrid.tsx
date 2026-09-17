import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { DesignCard } from "@/lib/catalog";
import { sortForCatalog } from "@/lib/catalog/sort";
import { ProductCard } from "./ProductCard";

// Grid shared by the home page and `/c/[category]` (Phase 5 step 4): applies
// the in-stock-first partition (sold-out, including archived, last) and the
// empty-category message (step 10).
export async function CatalogGrid({ designs, locale }: { designs: DesignCard[]; locale: Locale }) {
  const [tCatalog, tBadges] = await Promise.all([getTranslations("catalog"), getTranslations("badges")]);
  const sorted = sortForCatalog(designs);

  if (sorted.length === 0) {
    return <p className="text-sm text-ink/70">{tCatalog("empty")}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
      {sorted.map((design) => (
        <ProductCard key={design.id} design={design} locale={locale} soldOutLabel={tBadges("soldOut")} />
      ))}
    </div>
  );
}
