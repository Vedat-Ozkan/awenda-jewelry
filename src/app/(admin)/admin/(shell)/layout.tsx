import Link from "next/link";
import type { ReactNode } from "react";
import { TabBar, TopNav } from "@/components/admin/AdminNav";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Mobile-first admin shell (Silver Mist, DECISIONS.md "Visual redesign"): a
// floating white pill top bar (wordmark, section links from md up, sign-out)
// and, on phones, a floating tab bar at the bottom with safe-area padding for
// the standalone PWA. In its own route group so /admin/login and /admin/dev/*
// (outside this group) don't get this chrome. proxy.ts already guarantees a
// signed-in admin for every route here, so `user` below is never null in
// practice.
export default async function AdminShellLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-page font-sans text-ink">
      <header className="sticky top-0 z-30 px-3 pt-3 md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full bg-surface py-1.5 pl-5 pr-1.5 shadow-[0_2px_14px_rgba(30,31,36,0.08)]">
          <Link href="/admin/catalog" className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-medium tracking-tight">Awenda</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Admin</span>
          </Link>
          <TopNav />
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="hidden max-w-56 truncate lg:inline">{user?.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-full bg-mist px-4 text-sm font-semibold text-ink transition-colors hover:bg-ink/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 md:px-6 md:pb-12 md:pt-8">{children}</main>
      <TabBar />
    </div>
  );
}
