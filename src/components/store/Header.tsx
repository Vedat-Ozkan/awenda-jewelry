import { getTranslations } from "next-intl/server";
import { CartBadge } from "@/components/store/CartBadge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES } from "@/lib/catalog";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";

// Desktop nav shows a short list of categories (the rest are reachable from
// the home page tiles and the phone menu). Earring/bracelet drop off below xl
// so the pill never crowds at 1024px.
const DESKTOP_CATEGORIES = ["necklace", "ring", "earring", "bracelet"] as const;
const WIDE_ONLY = new Set<string>(["earring", "bracelet"]);

// Storefront header (Phase 5 step 3, cart wiring in step 6; Silver Mist
// redesign): a floating white pill — wordmark, links, language switch, Bag
// pill on desktop; wordmark, menu button, Bag pill below lg. Header itself
// stays an async server component for its translations; CartBadge and
// MobileMenu are the client bits. There is no material filter in the data
// model (material is free text), so no "Stainless steel"/"Sterling silver"
// nav links.
export async function Header({ locale }: { locale: Locale }) {
  const [t, tHeader] = await Promise.all([getTranslations("nav"), getTranslations("header")]);

  const links = [
    { href: "/#catalog", label: t("shopAll") },
    { href: "/?sort=newest#catalog", label: t("newIn") },
    ...CATEGORIES.map((category) => ({
      href: `/c/${category}`,
      label: t(category),
    })),
  ];
  const desktopLinks = [
    links[0],
    links[1],
    ...DESKTOP_CATEGORIES.map((category) => ({
      href: `/c/${category}`,
      label: t(category),
      wide: WIDE_ONLY.has(category),
    })),
  ];

  return (
    <header className="mx-auto w-full max-w-[1360px] px-3 pt-2.5 md:px-10 lg:pt-3.5">
      <div className="relative flex h-[60px] items-center justify-between rounded-full bg-white pl-5 pr-1.5 shadow-[0_1px_0_rgba(30,31,36,0.07)] lg:h-[76px] lg:pl-7 lg:pr-2.5">
        <Link href="/" locale={locale} className="shrink-0 font-serif text-2xl font-medium lg:text-[28px]">
          {tHeader("wordmark")}
        </Link>
        <nav
          aria-label={tHeader("primaryNav")}
          className="hidden items-center gap-6 text-[15px] font-medium lg:flex xl:gap-8"
        >
          {desktopLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              locale={locale}
              className={`h-11 items-center hover:text-accent ${"wide" in link && link.wide ? "hidden xl:flex" : "flex"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 lg:gap-1.5">
          <div className="hidden lg:block">
            <LanguageSwitcher locale={locale} />
          </div>
          <MobileMenu locale={locale} links={links} />
          <Link
            href="/cart"
            locale={locale}
            className="flex h-12 items-center rounded-full bg-accent px-[18px] text-sm font-semibold text-white hover:bg-accent-deep lg:h-14 lg:px-6 lg:text-base"
          >
            <CartBadge />
          </Link>
        </div>
      </div>
    </header>
  );
}
