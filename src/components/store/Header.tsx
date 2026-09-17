import { getTranslations } from "next-intl/server";
import { CartBadge } from "@/components/store/CartBadge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Database } from "@/lib/supabase/database.types";
import { LanguageSwitcher } from "./LanguageSwitcher";

type Category = Database["public"]["Enums"]["category"];

const CATEGORIES: Category[] = ["necklace", "bracelet", "anklet", "ring", "earring", "bangle", "chain", "pendant"];

// Storefront header (Phase 5 step 3, cart wiring in step 6): wordmark,
// category nav, language switcher, cart badge. Category links go to
// `/c/[category]` (step 4) — 404 for now, same as the footer's policy
// links. The cart icon links to `/cart` (step 6); its live count comes from
// CartBadge, a client component, since Header itself stays an async server
// component for its translations.
export async function Header({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const tHeader = await getTranslations("header");

  return (
    <header className="border-b border-gold-muted">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="/" locale={locale} className="shrink-0 font-serif text-xl tracking-wide text-ink">
          {tHeader("wordmark")}
        </Link>
        <nav className="flex min-w-0 gap-4 overflow-x-auto text-sm whitespace-nowrap">
          <Link href="/" locale={locale} className="text-ink/80 hover:text-ink">
            {t("all")}
          </Link>
          {CATEGORIES.map((category) => (
            <Link key={category} href={`/c/${category}`} locale={locale} className="text-ink/80 hover:text-ink">
              {t(category)}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-4">
          <LanguageSwitcher locale={locale} />
          <Link href="/cart" locale={locale}>
            <CartBadge />
          </Link>
        </div>
      </div>
    </header>
  );
}
