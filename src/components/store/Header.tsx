import { getTranslations } from "next-intl/server";
import { CartBadge } from "@/components/store/CartBadge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES, METALS } from "@/lib/catalog";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";

// Desktop nav priority (so the pill never crowds at 1024px): shop all, new in
// and the two metals always show; necklaces/rings join from xl (1280);
// earrings/bracelets from 2xl. Every category is still reachable from the
// home page tiles and the phone menu.
const DESKTOP_CATEGORIES = [
  { category: "necklace", show: "hidden xl:flex" },
  { category: "ring", show: "hidden xl:flex" },
  { category: "earring", show: "hidden 2xl:flex" },
  { category: "bracelet", show: "hidden 2xl:flex" },
] as const;

// Storefront header (Phase 5 step 3, cart wiring in step 6; Silver Mist
// redesign): a floating white pill — wordmark, links, language switch, Bag
// pill on desktop; wordmark, menu button, Bag pill below lg. Header itself
// stays an async server component for its translations; CartBadge and
// MobileMenu are the client bits. "Stainless steel" / "Sterling silver" link
// to the home listing filtered by metal (DECISIONS.md "Structured metal").
export async function Header({ locale }: { locale: Locale }) {
  const [t, tHeader, tMetal] = await Promise.all([
    getTranslations("nav"),
    getTranslations("header"),
    getTranslations("catalog.metal"),
  ]);

  const always = "flex";
  const primary = [
    { href: "/#catalog", label: t("shopAll"), show: always },
    { href: "/#new-in", label: t("newIn"), show: always },
    ...METALS.map((metal) => ({ href: `/?metal=${metal}#catalog`, label: tMetal(metal), show: always })),
  ];
  const links = [
    ...primary.map(({ href, label }) => ({ href, label })),
    ...CATEGORIES.map((category) => ({ href: `/c/${category}`, label: t(category) })),
  ];
  const desktopLinks = [
    ...primary,
    ...DESKTOP_CATEGORIES.map(({ category, show }) => ({ href: `/c/${category}`, label: t(category), show })),
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
              className={`h-11 items-center whitespace-nowrap hover:text-accent ${link.show}`}
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
