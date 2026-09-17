"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { publicPhotoUrl } from "@/lib/supabase/storage";
import { activateDesigns, archiveDesigns, restockDesigns, setPriceForDesigns } from "./actions";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

// Tailwind's `md` breakpoint. Rendering both the card list and the table and
// CSS-hiding one of them (as before) leaves two checkboxes with the same
// accessible name in the DOM at once — real assistive tech and Playwright's
// getByLabel() both see both. Rendering only one layout at a time avoids
// that. useSyncExternalStore (rather than useState + setState in an effect)
// subscribes to matchMedia the idiomatic way and reports `false` for the
// server/first-hydration snapshot, matching the server-rendered card list.
const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeToDesktopQuery(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getIsDesktop(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getIsDesktopServerSnapshot(): boolean {
  return false;
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeToDesktopQuery, getIsDesktop, getIsDesktopServerSnapshot);
}

interface Row {
  id: string;
  slug: string;
  category: string;
  name_en: string;
  name_fr: string | null;
  price_cents: number;
  status: string;
  thumb_image_path: string | null;
  totalQty: number;
}

// Seed rows point at public/seed/<slug>.svg (served as a static file, not a
// Storage object — see DECISIONS.md "Phase 2 plan drift"); everything else
// is a real photo in the `photos` Storage bucket.
function thumbSrc(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("seed/") ? `/${path}` : publicPhotoUrl(path);
}

// Card list (mobile) / table (>= md) with multi-select -> sticky bulk action
// bar (Phase 4 step 8). Row links to /admin/catalog/[id] (chunk C — 404s
// until that edit page lands).
export function CatalogList({ designs }: { designs: Row[] }) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [restockQty, setRestockQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
      setSelected(new Set());
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const ids = Array.from(selected);

  return (
    // Extra bottom padding while the sticky bulk-action bar is showing: the
    // bar (fixed, bottom-16) plus the bottom nav (fixed, bottom-0) together
    // cover roughly the last 8rem of the viewport, which otherwise hides —
    // and blocks clicks/checks on — the last rows of a long list.
    <div className={`mt-4 ${selected.size > 0 ? "pb-32" : ""}`}>
      {designs.length === 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">No designs match.</p>}

      {designs.length > 0 && !isDesktop && (
        <ul className="flex flex-col gap-2">
          {designs.map((d) => {
            const src = thumbSrc(d.thumb_image_path);
            return (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded border border-black/[.08] p-2 dark:border-white/[.145]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                  aria-label={`Select ${d.name_en}`}
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumb, not worth next/image config */}
                {src && <img src={src} alt="" className="h-12 w-12 rounded object-cover" />}
                <Link href={`/admin/catalog/${d.id}`} className="flex-1">
                  <p className="text-sm font-medium">{d.name_en}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {d.category} · {currency.format(d.price_cents / 100)} · qty {d.totalQty} · {d.status}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {designs.length > 0 && isDesktop && (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="w-8 p-2" />
              <th className="p-2">Photo</th>
              <th className="p-2">Name</th>
              <th className="p-2">Category</th>
              <th className="p-2">Price</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {designs.map((d) => {
              const src = thumbSrc(d.thumb_image_path);
              return (
                <tr key={d.id} className="border-t border-black/[.08] dark:border-white/[.145]">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggle(d.id)}
                      aria-label={`Select ${d.name_en}`}
                    />
                  </td>
                  <td className="p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin thumb, not worth next/image config */}
                    {src && <img src={src} alt="" className="h-10 w-10 rounded object-cover" />}
                  </td>
                  <td className="p-2">
                    <Link href={`/admin/catalog/${d.id}`} className="underline">
                      {d.name_en}
                    </Link>
                  </td>
                  <td className="p-2">{d.category}</td>
                  <td className="p-2">{currency.format(d.price_cents / 100)}</td>
                  <td className="p-2">{d.totalQty}</td>
                  <td className="p-2">{d.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 flex flex-wrap items-center gap-2 border-t border-black/[.08] bg-white p-3 text-sm dark:border-white/[.145] dark:bg-black">
          <span>{selected.size} selected</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => archiveDesigns(ids))}
            className="rounded border border-black/[.15] px-2 py-1 dark:border-white/[.2]"
          >
            Archive
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => activateDesigns(ids))}
            className="rounded border border-black/[.15] px-2 py-1 dark:border-white/[.2]"
          >
            Activate
          </button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              aria-label="Restock quantity"
              className="w-16 rounded border border-black/[.15] px-1 py-1 dark:border-white/[.2]"
            />
            <button
              type="button"
              disabled={pending || !(Number(restockQty) > 0)}
              onClick={() => run(() => restockDesigns(ids, Number(restockQty)))}
              className="rounded border border-black/[.15] px-2 py-1 dark:border-white/[.2]"
            >
              Restock +N
            </button>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Price CAD"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              aria-label="New price (CAD)"
              className="w-24 rounded border border-black/[.15] px-1 py-1 dark:border-white/[.2]"
            />
            <button
              type="button"
              disabled={pending || !(Number(newPrice) > 0)}
              onClick={() => run(() => setPriceForDesigns(ids, Math.round(Number(newPrice) * 100)))}
              className="rounded border border-black/[.15] px-2 py-1 dark:border-white/[.2]"
            >
              Set price
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
