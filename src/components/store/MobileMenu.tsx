"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LanguageSwitcher } from "./LanguageSwitcher";

export interface MenuLink {
  href: string;
  label: string;
}

// Phone/tablet navigation (< lg): a menu button in the navbar pill that
// discloses a card under it with every nav link plus the language switch.
// A disclosure, not a modal: the button carries aria-expanded/aria-controls,
// Escape or a tap outside closes it and returns focus to the button, and
// following a link closes it too.
export function MobileMenu({ locale, links }: { locale: Locale; links: MenuLink[] }) {
  const t = useTranslations("header");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  // Close after navigating (in-page hash links don't change the pathname, so
  // the links also close it directly). Adjusting state during render, not in
  // an effect: https://react.dev/learn/you-might-not-need-an-effect
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? t("closeMenu") : t("menu")}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full bg-mist text-ink hover:bg-ink/10"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
        </svg>
      </button>
      {open && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
          />
          <div
            id={panelId}
            className="absolute inset-x-0 top-full z-50 mt-2 rounded-3xl bg-white p-3 shadow-[0_8px_30px_rgba(30,31,36,0.12)]"
          >
            <nav aria-label={t("primaryNav")} className="flex flex-col">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  locale={locale}
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center rounded-2xl px-4 text-base font-medium hover:bg-mist"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-1 border-t border-ink/10 px-2 pt-1">
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
