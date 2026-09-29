"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Section links (desktop pill bar) and the phone tab bar. Only one of the two
// is displayed at a time (CSS, md breakpoint), and display:none links are
// left out of the accessibility tree, so each name is unique to assistive
// tech and to Playwright's getByRole.

const isCatalog = (p: string) => p.startsWith("/admin/catalog") && !p.startsWith("/admin/catalog/new");
const isNew = (p: string) => p.startsWith("/admin/catalog/new");

const icon = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const TOP_LINKS = [
  { href: "/admin/catalog", label: "Catalog", active: (p: string) => p.startsWith("/admin/catalog") },
  { href: "/admin/orders", label: "Orders", active: (p: string) => p.startsWith("/admin/orders") },
  { href: "/admin/analytics", label: "Analytics", active: (p: string) => p.startsWith("/admin/analytics") },
  { href: "/admin/settings", label: "Settings", active: (p: string) => p.startsWith("/admin/settings") },
];

const TABS = [
  {
    href: "/admin/catalog",
    label: "Catalog",
    active: isCatalog,
    icon: icon(
      <>
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </>,
    ),
  },
  {
    href: "/admin/catalog/new",
    label: "New",
    active: isNew,
    icon: icon(<path d="M12 5v14M5 12h14" />),
  },
  {
    href: "/admin/orders",
    label: "Orders",
    active: (p: string) => p.startsWith("/admin/orders"),
    icon: icon(
      <>
        <path d="M6 7h13l-1.4 8.2a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.6L5.2 4H3" />
        <circle cx="9.5" cy="20" r="1" />
        <circle cx="16.5" cy="20" r="1" />
      </>,
    ),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    active: (p: string) => p.startsWith("/admin/analytics"),
    icon: icon(<path d="M5 20V11M12 20V5M19 20v-7" />),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    active: (p: string) => p.startsWith("/admin/settings"),
    icon: icon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>,
    ),
  },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
      {TOP_LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active(pathname) ? "page" : undefined}
          className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
            l.active(pathname) ? "bg-mist text-ink" : "text-muted hover:bg-mist/60 hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex rounded-full bg-surface p-1.5 shadow-[0_2px_18px_rgba(30,31,36,0.14)] md:hidden"
    >
      {TABS.map((t) => {
        const active = t.active(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors ${
              active ? "bg-ink text-page" : "text-muted"
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
