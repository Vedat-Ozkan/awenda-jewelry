"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Database } from "@/lib/supabase/database.types";
import {
  cardClass,
  dangerButton,
  errorClass,
  h1Class,
  h2Class,
  inputClass,
  labelClass,
  mutedClass,
  noticeClass,
  pillClass,
  primaryButton,
  softButton,
  statusChipClass,
} from "@/components/admin/ui";
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

  const link = "font-medium text-accent underline underline-offset-4";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className={h1Class}>Order {order.id.slice(0, 8)}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className={pillClass}>{order.fulfillment === "ship" ? "Ship" : "Pickup"}</span>
        <span className={statusChipClass(order.status)}>{statusLabel(order.status)}</span>
        <span>placed {dateTime.format(new Date(order.created_at))}</span>
      </p>

      {error && <p className={errorClass}>{error}</p>}
      {notice && <p className={noticeClass}>{notice}</p>}

      {order.status === "awaiting_shipment" && (
        <section className={`${cardClass} mt-6`}>
          <h2 className={h2Class}>Mark shipped</h2>
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
            className={`${primaryButton} mt-5 h-12 w-full md:w-auto`}
          >
            Mark shipped
          </button>
        </section>
      )}

      {order.status === "awaiting_pickup" && (
        <section className={`${cardClass} mt-6`}>
          <h2 className={h2Class}>Pickup</h2>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markPickedUp(order.id))}
            className={`${primaryButton} mt-3 h-12 w-full md:w-auto`}
          >
            Mark picked up
          </button>
        </section>
      )}

      <section className={`${cardClass} mt-4`}>
        <h2 className={h2Class}>Items</h2>
        <ul className="mt-3 flex flex-col divide-y divide-ink/10">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
              <div>
                <p className="font-medium">
                  {item.name_snapshot} — {item.variant_label_snapshot}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  qty {item.qty} · {currency.format(item.unit_price_cents / 100)} each{" "}
                  {!item.fulfilled && <span className="font-medium text-red-700">· refunded</span>}
                </p>
              </div>
              <span className="tabular-nums">{currency.format((item.unit_price_cents * item.qty) / 100)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{currency.format(order.subtotal_cents / 100)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd className="tabular-nums">{currency.format(order.shipping_cents / 100)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Tax</dt>
            <dd className="tabular-nums">{currency.format(order.tax_cents / 100)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{currency.format(order.total_cents / 100)}</dd>
          </div>
        </dl>
      </section>

      <section className={`${cardClass} mt-4`}>
        <h2 className={h2Class}>Customer</h2>
        <p className="mt-2 text-sm">{order.customer_name || "—"}</p>
        <p className="text-sm">{order.customer_email}</p>
        <p className="text-sm">{order.customer_phone || "—"}</p>

        {shippingAddress && (
          <>
            <h2 className={`${h2Class} mt-5`}>Shipping address</h2>
            <p className="mt-2 text-sm">{shippingAddress.name || order.customer_name}</p>
            <p className="text-sm">{shippingAddress.address?.line1}</p>
            {shippingAddress.address?.line2 && <p className="text-sm">{shippingAddress.address.line2}</p>}
            <p className="text-sm">
              {shippingAddress.address?.city}, {shippingAddress.address?.state} {shippingAddress.address?.postal_code}
            </p>
            <p className="text-sm">{shippingAddress.address?.country}</p>
          </>
        )}
      </section>

      {(order.shipped_at ||
        order.picked_up_at ||
        order.refunded_at ||
        order.tracking_number ||
        order.stripe_payment_intent_id) && (
      <section className={`${cardClass} mt-4 space-y-1 text-sm`}>
        <h2 className={`${h2Class} mb-2`}>Fulfilment</h2>
        {order.shipped_at && <p>Shipped: {dateTime.format(new Date(order.shipped_at))}</p>}
        {order.picked_up_at && <p>Picked up: {dateTime.format(new Date(order.picked_up_at))}</p>}
        {order.refunded_at && <p>Refunded: {dateTime.format(new Date(order.refunded_at))}</p>}
        {order.tracking_number && (
          <p>
            Tracking:{" "}
            {order.tracking_url ? (
              <a href={order.tracking_url} target="_blank" rel="noreferrer" className={link}>
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
              className={link}
            >
              View payment in Stripe
            </a>
          </p>
        )}
      </section>
      )}

      {order.stripe_payment_intent_id && fulfilledItems.length > 0 && (
        <section className={`${cardClass} mt-4`}>
          <h2 className={h2Class}>Refund</h2>
          <ul className="mt-2 flex flex-col">
            {fulfilledItems.map((item) => (
              <li key={item.id}>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    aria-label={`Refund ${item.name_snapshot} — ${item.variant_label_snapshot}`}
                    className="h-5 w-5 accent-accent"
                  />
                  <span>
                    {item.name_snapshot} — {item.variant_label_snapshot} ({currency.format(item.unit_price_cents / 100)})
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || selectedItemIds.size === 0}
              onClick={() => run(() => refundOrder(order.id, { itemIds: Array.from(selectedItemIds) }))}
              className={dangerButton}
            >
              Refund selected
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => refundOrder(order.id))} className={dangerButton}>
              Refund all
            </button>
          </div>
        </section>
      )}

      <section className={`${cardClass} mt-4`}>
        <h2 className={h2Class}>Resend email</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => handleResend("confirmation")} className={softButton}>
            Resend confirmation
          </button>
          {order.shipped_at && (
            <button type="button" disabled={pending} onClick={() => handleResend("shipped")} className={softButton}>
              Resend shipped
            </button>
          )}
          {unfulfilledItems.length > 0 && (
            <button type="button" disabled={pending} onClick={() => handleResend("refund")} className={softButton}>
              Resend refund notice
            </button>
          )}
        </div>
      </section>

      {movements.length > 0 && (
        <section className={`${cardClass} mt-4`}>
          <h2 className={h2Class}>Inventory movements</h2>
          <ul className={`${mutedClass} mt-2 flex flex-col gap-1`}>
            {movements.map((m) => (
              <li key={m.id}>
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
