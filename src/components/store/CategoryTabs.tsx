import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES, type Sort } from "@/lib/catalog";
import type { Database } from "@/lib/supabase/database.types";

type Category = Database["public"]["Enums"]["category"];

// Catalog-page category tabs (Phase 5 step 4): "All" + the 8 categories,
// reusing Header's `nav` translations. Distinct from Header's own top nav
// (chunk A, step 3) — these live on the catalog pages themselves and carry
// the current `sort` selection across tab switches, which the header links
// don't need to do.
export async function CategoryTabs({ locale, active, sort }: { locale: Locale; active?: Category; sort: Sort }) {
  const t = await getTranslations("nav");
  const query = sort === "newest" ? "" : `?sort=${sort}`;

  const pill = (isActive: boolean) =>
    isActive
      ? "shrink-0 rounded-full bg-gold px-4 py-1.5 text-ivory"
      : "shrink-0 rounded-full px-4 py-1.5 text-ink/70 decoration-gold decoration-2 underline-offset-4 hover:text-ink hover:underline";

  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        href={`/${query}`}
        locale={locale}
        aria-current={!active ? "page" : undefined}
        className={pill(!active)}
      >
        {t("all")}
      </Link>
      {CATEGORIES.map((category) => (
        <Link
          key={category}
          href={`/c/${category}${query}`}
          locale={locale}
          aria-current={active === category ? "page" : undefined}
          className={pill(active === category)}
        >
          {t(category)}
        </Link>
      ))}
    </nav>
  );
}
