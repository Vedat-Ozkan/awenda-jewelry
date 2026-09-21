"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Database } from "@/lib/supabase/database.types";
import { markPickedUp, markShipped, refundOrder, resendEmail } from "../actions";
import { CARRIERS } from "../carriers";

type Order = Database["public"]["Tables"]["orders"]["Row"];

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const dateTime = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeStyle: "short" });

interface Item {
  id: string;
  name_snapshot: string;
  variant_label_snapshot: string;
  unit_price_cents: number;
  qty: number;
  fulfilled: boolean;
}

interface Movement {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
}

// Stripe's Checkout collected_information.shipping_details shape
// (src/app/api/stripe/webhook/route.ts stores this jsonb as-is).
interface ShippingAddress {
  name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

const buttonClass = "rounded border border-black/[.15] px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/[.2]";
const primaryButtonClass =
  "rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black";
const inputClass = "mt-1 block w-full rounded border border-black/[.15] px-3 py-2 text-sm dark:border-white/[.2]";
const labelClass = "mt-4 block text-sm font-medium";

// Order detail (Phase 6 step 6): items/customer/address/totals/timestamps,
// the Stripe payment link, the movement ledger, and the four admin actions
// (markShipped, markPickedUp, refundOrder, resendEmail). router.refresh()
// after every mutation, same pattern as EditDesignClient.
export function OrderDetailClient({ order, items, movements }: { order: Order; items: Item[]; movements: Movement[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [carrier, setCarrier] = useState<(typeof CARRIERS)[number]["value"]>("canada_post");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const fulfilledItems = items.filter((i) => i.fulfilled);
  const unfulfilledItems = items.filter((i) => !i.fulfilled);
  const shippingAddress = order.fulfillment === "ship" ? (order.shipping_address as ShippingAddress | null) : null;

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: () => Promise<{ ok: true; emailFailed?: boolean } | void>) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (result?.emailFailed) setNotice("Saved, but the email failed to send — use Resend below.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function handleResend(kind: "confirmation" | "shipped" | "refund") {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resendEmail(order.id, kind);
      setNotice(result.ok ? "Email sent." : "Email failed to send.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-4 pb-24">
      <h1 className="text-lg font-semibold">Order {order.id.slice(0, 8)}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {order.fulfillment === "ship" ? "Ship" : "Pickup"} · {statusLabel(order.status)} · placed{" "}
        {dateTime.format(new Date(order.created_at))}
      </p>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

      <section className="mt-4">
        <h2 className="text-sm font-semibold">Customer</h2>
        <p className="mt-1 text-sm">{order.customer_name || "—"}</p>
        <p className="text-sm">{order.customer_email}</p>
        <p className="text-sm">{order.customer_phone || "—"}</p>
      </section>

      {shippingAddress && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold">Shipping address</h2>
          <p className="mt-1 text-sm">{shippingAddress.name || order.customer_name}</p>
          <p className="text-sm">{shippingAddress.address?.line1}</p>
          {shippingAddress.address?.line2 && <p className="text-sm">{shippingAddress.address.line2}</p>}
          <p className="text-sm">
            {shippingAddress.address?.city}, {shippingAddress.address?.state} {shippingAddress.address?.postal_code}
          </p>
          <p className="text-sm">{shippingAddress.address?.country}</p>
        </section>
      )}

      <section className="mt-4">
        <h2 className="text-sm font-semibold">Items</h2>
        <ul className="mt-1 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded border border-black/[.08] p-2 text-sm dark:border-white/[.145]">
              <div>
                <p>
                  {item.name_snapshot} — {item.variant_label_snapshot}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  qty {item.qty} · {currency.format(item.unit_price_cents / 100)} each{" "}
                  {!item.fulfilled && <span className="text-red-600 dark:text-red-400">· refunded</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 text-sm">
        <p>Subtotal: {currency.format(order.subtotal_cents / 100)}</p>
        <p>Shipping: {currency.format(order.shipping_cents / 100)}</p>
        <p>Tax: {currency.format(order.tax_cents / 100)}</p>
        <p className="font-semibold">Total: {currency.format(order.total_cents / 100)}</p>
      </section>

      <section className="mt-4 text-sm">
        {order.shipped_at && <p>Shipped: {dateTime.format(new Date(order.shipped_at))}</p>}
        {order.picked_up_at && <p>Picked up: {dateTime.format(new Date(order.picked_up_at))}</p>}
        {order.refunded_at && <p>Refunded: {dateTime.format(new Date(order.refunded_at))}</p>}
        {order.tracking_number && (
          <p>
            Tracking: {order.tracking_url ? (
              <a href={order.tracking_url} target="_blank" rel="noreferrer" className="underline">
                {order.tracking_number}
              </a>
            ) : (
              order.tracking_number
            )}
          </p>
        )}
        {order.stripe_payment_intent_id && (
          <p>
            <a
              href={`https://dashboard.stripe.com/test/payments/${order.stripe_payment_intent_id}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View payment in Stripe
            </a>
          </p>
        )}
      </section>

      {order.status === "awaiting_shipment" && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Mark shipped</h2>
          <label className={labelClass}>
            Carrier
            <select value={carrier} onChange={(e) => setCarrier(e.target.value as typeof carrier)} className={inputClass}>
              {CARRIERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Tracking number
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={pending || trackingNumber.trim() === ""}
            onClick={() => run(() => markShipped(order.id, { carrier, trackingNumber: trackingNumber.trim() }))}
            className={`${primaryButtonClass} mt-3`}
          >
            Mark shipped
          </button>
        </section>
      )}

      {order.status === "awaiting_pickup" && (
        <section className="mt-6">
          <button type="button" disabled={pending} onClick={() => run(() => markPickedUp(order.id))} className={primaryButtonClass}>
            Mark picked up
          </button>
        </section>
      )}

      {order.stripe_payment_intent_id && fulfilledItems.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Refund</h2>
          <ul className="mt-1 flex flex-col gap-1">
            {fulfilledItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedItemIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  aria-label={`Refund ${item.name_snapshot} — ${item.variant_label_snapshot}`}
                />
                {item.name_snapshot} — {item.variant_label_snapshot} ({currency.format(item.unit_price_cents / 100)})
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || selectedItemIds.size === 0}
              onClick={() => run(() => refundOrder(order.id, { itemIds: Array.from(selectedItemIds) }))}
              className={buttonClass}
            >
              Refund selected
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => refundOrder(order.id))} className={buttonClass}>
              Refund all
            </button>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Resend email</h2>
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => handleResend("confirmation")} className={buttonClass}>
            Resend confirmation
          </button>
          {order.shipped_at && (
            <button type="button" disabled={pending} onClick={() => handleResend("shipped")} className={buttonClass}>
              Resend shipped
            </button>
          )}
          {unfulfilledItems.length > 0 && (
            <button type="button" disabled={pending} onClick={() => handleResend("refund")} className={buttonClass}>
              Resend refund notice
            </button>
          )}
        </div>
      </section>

      {movements.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Inventory movements</h2>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="text-zinc-600 dark:text-zinc-400">
                {m.delta > 0 ? "+" : ""}
                {m.delta} · {m.reason} · {dateTime.format(new Date(m.created_at))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
