import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Mobile-first admin shell (Phase 4 step 2): bottom nav with Catalog · Orders
// · Analytics · Settings, header with the signed-in email + sign-out. In its
// own route group so /admin/login and /admin/dev/* (outside this group)
// don't get this chrome. proxy.ts already guarantees a signed-in admin for
// every route here, so `user` below is never null in practice.
const NAV = [
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export default async function AdminShellLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-black/[.08] px-4 py-3 dark:border-white/[.145]">
        <span className="text-sm font-semibold tracking-tight">Awenda Admin</span>
        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="truncate">{user?.email}</span>
          <form action={signOut}>
            <button type="submit" className="underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 pb-16">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-black/[.08] bg-white dark:border-white/[.145] dark:bg-black">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="flex-1 py-3 text-center text-sm">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
