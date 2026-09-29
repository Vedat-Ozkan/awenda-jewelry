"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bareInputClass, chipClass, errorClass, mutedClass, pillClass, primaryButton, statusChipClass } from "@/components/admin/ui";
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
    <div className="mt-5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`${chipClass(filter === f.key)} shrink-0`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFilter("pickups")}
          className={`${chipClass(filter === "pickups")} shrink-0`}
        >
          Pickups
        </button>
      </div>

      <input
        type="search"
        placeholder="Search name or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search orders"
        className={`${bareInputClass} mt-3 md:max-w-sm`}
      />

      {error && <p className={errorClass}>{error}</p>}

      {filtered.length === 0 && <p className={`${mutedClass} mt-5`}>No orders match.</p>}

      <ul className="mt-4 flex flex-col gap-2">
        {filtered.map((o) => (
          <li
            key={o.id}
            className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-[0_1px_0_rgba(30,31,36,0.07)]"
          >
            <Link href={`/admin/orders/${o.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{o.customer_name || o.customer_email}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span className={pillClass}>{o.fulfillment === "ship" ? "Ship" : "Pickup"}</span>
                <span className={statusChipClass(o.status)}>{statusLabel(o.status)}</span>
                <span>
                  {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                </span>
              </p>
            </Link>
            <span className="text-sm font-semibold tabular-nums text-ink">{currency.format(o.total_cents / 100)}</span>
            {filter === "pickups" && o.status === "awaiting_pickup" && (
              <button
                type="button"
                disabled={pendingId === o.id}
                onClick={() => handlePickedUp(o.id)}
                className={primaryButton}
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
