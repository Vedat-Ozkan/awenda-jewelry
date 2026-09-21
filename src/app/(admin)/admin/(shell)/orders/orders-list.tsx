"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { markPickedUp } from "./actions";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "awaiting_pickup", label: "Awaiting pickup" },
  { key: "awaiting_shipment", label: "Awaiting shipment" },
  { key: "shipped", label: "Shipped" },
  { key: "picked_up", label: "Picked up" },
  { key: "refunded", label: "Refunded" },
] as const;
type FilterKey = (typeof STATUS_FILTERS)[number]["key"] | "pickups";

interface Row {
  id: string;
  status: string;
  fulfillment: string;
  customer_name: string | null;
  customer_email: string;
  total_cents: number;
  created_at: string;
  itemCount: number;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-sm ${
    active
      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
      : "border-black/[.15] dark:border-white/[.2]"
  }`;

// List + Pickups tab (Phase 6 step 6): filter chips and search are client
// state, not URL search params — the "Picked up" one-tap button updates a
// row's status locally so it leaves the Pickups tab immediately, without a
// full page reload. Server data is only ~200 rows, so client-side filtering
// is cheap.
export function OrdersList({ orders }: { orders: Row[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rows, setRows] = useState(orders);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((o) => {
      if (filter === "pickups") {
        if (o.status !== "awaiting_pickup") return false;
      } else if (filter !== "all" && o.status !== filter) {
        return false;
      }
      if (q && !(o.customer_email.toLowerCase().includes(q) || (o.customer_name ?? "").toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [rows, filter, query]);

  async function handlePickedUp(id: string) {
    setPendingId(id);
    setError(null);
    try {
      await markPickedUp(id);
      setRows((prev) => prev.map((o) => (o.id === id ? { ...o, status: "picked_up" } : o)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={chipClass(filter === f.key)}>
            {f.label}
          </button>
        ))}
        <button type="button" onClick={() => setFilter("pickups")} className={chipClass(filter === "pickups")}>
          Pickups
        </button>
      </div>

      <input
        type="search"
        placeholder="Search name or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search orders"
        className="mt-3 w-full rounded border border-black/[.15] px-2 py-1.5 text-sm dark:border-white/[.2]"
      />

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {filtered.length === 0 && <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No orders match.</p>}

      <ul className="mt-4 flex flex-col gap-2">
        {filtered.map((o) => (
          <li
            key={o.id}
            className="flex items-center gap-3 rounded border border-black/[.08] p-2 dark:border-white/[.145]"
          >
            <Link href={`/admin/orders/${o.id}`} className="flex-1">
              <p className="text-sm font-medium">{o.customer_name || o.customer_email}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                  {o.fulfillment === "ship" ? "Ship" : "Pickup"}
                </span>{" "}
                · {statusLabel(o.status)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} ·{" "}
                {currency.format(o.total_cents / 100)}
              </p>
            </Link>
            {filter === "pickups" && o.status === "awaiting_pickup" && (
              <button
                type="button"
                disabled={pendingId === o.id}
                onClick={() => handlePickedUp(o.id)}
                className="rounded border border-black/[.15] px-2 py-1 text-sm dark:border-white/[.2]"
              >
                Picked up
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
