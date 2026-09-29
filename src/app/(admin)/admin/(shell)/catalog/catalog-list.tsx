"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { publicPhotoUrl } from "@/lib/supabase/storage";
import { bareInputClass, mutedClass, pillClass, primaryButton, softButton, statusChipClass } from "@/components/admin/ui";
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
  metal: "stainless_steel" | "sterling_silver";
  name_en: string;
  name_fr: string | null;
  price_cents: number;
  status: string;
  thumb_image_path: string | null;
  totalQty: number;
}

const METAL_LABELS = { stainless_steel: "Stainless steel", sterling_silver: "Sterling silver" } as const;

// Seed rows point at public/seed/<slug>.svg (served as a static file, not a
// Storage object — see DECISIONS.md "Phase 2 plan drift"); everything else
// is a real photo in the `photos` Storage bucket.
function thumbSrc(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("seed/") ? `/${path}` : publicPhotoUrl(path);
}

function Thumb({ src, className }: { src: string | null; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- admin thumb, not worth next/image config
  if (src) return <img src={src} alt="" className={`${className} bg-well object-cover`} />;
  return <div className={`${className} bg-well`} />;
}

// Card list (mobile) / table (>= md) with multi-select -> floating bulk action
// bar (Phase 4 step 8). Row links to /admin/catalog/[id].

// 44px tap area around the native checkbox.
const checkboxWrap = "flex h-11 w-11 shrink-0 items-center justify-center";
const checkbox = "h-5 w-5 accent-accent";
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
    // Extra bottom padding while the bulk-action bar is showing: on phones it
    // floats above the tab bar (bottom-[...] below), which otherwise hides —
    // and blocks clicks/checks on — the last rows of a long list.
    <div className={`mt-6 ${selected.size > 0 ? "pb-40 md:pb-24" : ""}`}>
      {designs.length === 0 && <p className={mutedClass}>No designs match.</p>}

      {designs.length > 0 && !isDesktop && (
        <ul className="flex flex-col gap-2">
          {designs.map((d) => {
            const src = thumbSrc(d.thumb_image_path);
            return (
              <li
                key={d.id}
                className="flex items-center gap-1 rounded-3xl bg-surface p-2 pr-3 shadow-[0_1px_0_rgba(30,31,36,0.07)]"
              >
                <label className={checkboxWrap}>
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    aria-label={`Select ${d.name_en}`}
                    className={checkbox}
                  />
                </label>
                <Thumb src={src} className="h-16 w-16 shrink-0 rounded-2xl" />
                <Link href={`/admin/catalog/${d.id}`} className="ml-2 min-w-0 flex-1 py-1">
                  <p className="truncate text-sm font-semibold text-ink">{d.name_en}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {d.category} · {METAL_LABELS[d.metal]}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span className="font-semibold text-ink">{currency.format(d.price_cents / 100)}</span>
                    <span>qty {d.totalQty}</span>
                    <span className={statusChipClass(d.status)}>{d.status}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {designs.length > 0 && isDesktop && (
        <div className="overflow-x-auto rounded-3xl bg-surface p-3 shadow-[0_1px_0_rgba(30,31,36,0.07)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="w-12 p-2" />
                <th className="p-2">Photo</th>
                <th className="p-2">Name</th>
                <th className="p-2">Category</th>
                <th className="p-2">Metal</th>
                <th className="p-2">Price</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {designs.map((d) => {
                const src = thumbSrc(d.thumb_image_path);
                return (
                  <tr key={d.id} className="border-t border-ink/10 hover:bg-page/70">
                    <td className="p-1">
                      <label className={checkboxWrap}>
                        <input
                          type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={() => toggle(d.id)}
                          aria-label={`Select ${d.name_en}`}
                          className={checkbox}
                        />
                      </label>
                    </td>
                    <td className="p-2">
                      <Thumb src={src} className="h-12 w-12 rounded-xl" />
                    </td>
                    <td className="p-2">
                      <Link href={`/admin/catalog/${d.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                        {d.name_en}
                      </Link>
                    </td>
                    <td className="p-2 text-muted">{d.category}</td>
                    <td className="p-2">
                      <span className={pillClass}>{METAL_LABELS[d.metal]}</span>
                    </td>
                    <td className="p-2 tabular-nums">{currency.format(d.price_cents / 100)}</td>
                    <td className="p-2 tabular-nums">{d.totalQty}</td>
                    <td className="p-2">
                      <span className={statusChipClass(d.status)}>{d.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-3xl bg-surface p-3 text-sm shadow-[0_2px_18px_rgba(30,31,36,0.18)] md:bottom-6"
        >
          <span className="px-2 font-semibold">{selected.size} selected</span>
          <button type="button" disabled={pending} onClick={() => run(() => archiveDesigns(ids))} className={softButton}>
            Archive
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => activateDesigns(ids))} className={softButton}>
            Activate
          </button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              aria-label="Restock quantity"
              className={`${bareInputClass} w-16 px-2 text-center`}
            />
            <button
              type="button"
              disabled={pending || !(Number(restockQty) > 0)}
              onClick={() => run(() => restockDesigns(ids, Number(restockQty)))}
              className={primaryButton}
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
              className={`${bareInputClass} w-28 px-3`}
            />
            <button
              type="button"
              disabled={pending || !(Number(newPrice) > 0)}
              onClick={() => run(() => setPriceForDesigns(ids, Math.round(Number(newPrice) * 100)))}
              className={primaryButton}
            >
              Set price
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
