import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart } from "@/components/admin/BarChart";
import {
  countNewsletterSubscribers,
  countStockNotifications,
  listNewsletterSubscribers,
  listStockNotifications,
} from "@/lib/analytics/leads";
import {
  PRESET_DAYS,
  averageOrderValueCents,
  conversionRate,
  resolveRange,
  summarySchema,
} from "@/lib/analytics/summary";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_TIMEZONE = "America/New_York"; // keep in sync with 0013_analytics_functions.sql
const LEAD_ROWS_SHOWN = 100;
const CF_DASHBOARD_URL = "https://dash.cloudflare.com/?to=/:account/web-analytics";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const currencyWhole = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-CA", { style: "percent", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" });

const isoDay = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));

function Tile({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div data-testid={`tile-${id}`} className="rounded border border-black/[.08] p-3">
      <div className="text-xs text-zinc-600">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function DataTable({
  id,
  title,
  headers,
  rows,
  empty,
}: {
  id: string;
  title: string;
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <section data-testid={`table-${id}`} className="mt-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-600">{empty}</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-zinc-600">
                {headers.map((h, i) => (
                  <th key={h} className={`py-1 font-normal ${i > 0 ? "pl-3 text-right" : "pr-3"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-black/[.06]">
                  {row.map((cell, i) => (
                    <td key={i} className={`py-1.5 ${i > 0 ? "pl-3 text-right tabular-nums" : "pr-3"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-sm ${active ? "border-black bg-black text-white" : "border-black/[.15]"}`;

// Analytics (Phase 7 step 5): server component. Everything is RLS-enforced via
// the admin's cookie session; the aggregates come from analytics_summary()
// (0013_analytics_functions.sql). The range lives in the URL: ?range=7|30|90
// or ?from=&to= (YYYY-MM-DD, in the market's timezone).
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("market_timezone")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) throw settingsError;
  const timeZone = settings?.market_timezone ?? FALLBACK_TIMEZONE;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); // YYYY-MM-DD

  const range = resolveRange(params, today);
  const { data, error } = await supabase.rpc("analytics_summary", { p_from: range.from, p_to: range.to });
  if (error) throw error;
  const summary = summarySchema.parse(data);

  const [stockNotifications, subscribers, stockCounts, subscriberCounts] = await Promise.all([
    listStockNotifications(LEAD_ROWS_SHOWN),
    listNewsletterSubscribers(LEAD_ROWS_SHOWN),
    countStockNotifications(),
    countNewsletterSubscribers(),
  ]);

  const sessionsShare = (n: number) => (summary.sessions > 0 ? ` (${percent.format(n / summary.sessions)})` : "");

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Analytics</h1>
        <a href={CF_DASHBOARD_URL} target="_blank" rel="noreferrer" className="text-sm underline">
          Cloudflare Web Analytics (traffic detail)
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PRESET_DAYS.map((days) => (
          <Link key={days} href={`/admin/analytics?range=${days}`} className={chipClass(range.preset === days)}>
            {days} days
          </Link>
        ))}
        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            From
            <input type="date" name="from" defaultValue={range.from} required className="rounded border border-black/[.15] px-2 py-1" />
          </label>
          <label className="flex items-center gap-1">
            To
            <input type="date" name="to" defaultValue={range.to} required className="rounded border border-black/[.15] px-2 py-1" />
          </label>
          <button type="submit" className={chipClass(range.preset === null)}>
            Apply
          </button>
        </form>
      </div>
      <p className="mt-2 text-xs text-zinc-600" data-testid="analytics-range">
        {range.from} to {range.to} ({timeZone})
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile id="sessions" label="Sessions">
          {summary.sessions}
        </Tile>
        <Tile id="design-views" label="Design views">
          {summary.design_views}
        </Tile>
        <Tile id="add-to-carts" label="Add to carts">
          {summary.add_to_carts}
        </Tile>
        <Tile id="checkouts" label="Checkouts started">
          {summary.begin_checkouts}
        </Tile>
        <Tile id="orders" label="Orders">
          {summary.orders}
        </Tile>
        <Tile id="revenue" label="Revenue">
          {currency.format(summary.revenue_cents / 100)}
        </Tile>
        <Tile id="conversion" label="Conversion (orders / sessions)">
          {percent.format(conversionRate(summary))}
        </Tile>
        <Tile id="aov" label="Average order value">
          {currency.format(averageOrderValueCents(summary) / 100)}
        </Tile>
        <Tile id="fulfillment" label="Ship / pickup">
          {summary.ship_orders} / {summary.pickup_orders}
        </Tile>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <BarChart
          title="Sessions by day"
          data={summary.by_day.map((d) => ({ label: isoDay(d.day), value: d.sessions }))}
        />
        <BarChart
          title="Orders by day"
          data={summary.by_day.map((d) => ({ label: isoDay(d.day), value: d.orders }))}
        />
        <BarChart
          title="Revenue by week (week starting)"
          data={summary.revenue_by_week.map((w) => ({ label: isoDay(w.week), value: w.revenue_cents / 100 }))}
          formatValue={(n) => currencyWhole.format(n)}
        />
      </div>

      <DataTable
        id="top-designs"
        title="Top viewed designs"
        headers={["Design", "Views"]}
        rows={summary.top_designs.map((d) => [d.name, d.views])}
        empty="No design views in this range."
      />
      <DataTable
        id="sold-out-designs"
        title="Most viewed sold-out designs (demand you're missing)"
        headers={["Design", "Views"]}
        rows={summary.sold_out_designs.map((d) => [d.name, d.views])}
        empty="No views of sold-out designs in this range."
      />
      <DataTable
        id="referrers"
        title="Top referrer hosts"
        headers={["Host", "Sessions"]}
        rows={summary.referrers.map((r) => [r.host, r.sessions])}
        empty="No referrers in this range."
      />
      <DataTable
        id="locales"
        title="Locale split"
        headers={["Locale", "Sessions"]}
        rows={summary.locales.map((l) => [l.locale.toUpperCase(), `${l.sessions}${sessionsShare(l.sessions)}`])}
        empty="No sessions in this range."
      />
      <DataTable
        id="devices"
        title="Device split"
        headers={["Device", "Sessions"]}
        rows={summary.devices.map((d) => [d.device, `${d.sessions}${sessionsShare(d.sessions)}`])}
        empty="No sessions in this range."
      />

      <h2 className="mt-10 text-base font-semibold">Leads</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Tile id="stock-leads" label="Notify-me sign-ups (active / total)">
          {stockCounts.active} / {stockCounts.total}
        </Tile>
        <Tile id="newsletter-leads" label="Newsletter subscribers (active / total)">
          {subscriberCounts.active} / {subscriberCounts.total}
        </Tile>
      </div>

      <section data-testid="leads-stock" className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Notify me when it&apos;s back</h2>
          <a href="/api/admin/stock-notifications.csv" className="text-sm underline">
            Export CSV
          </a>
        </div>
        {stockNotifications.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600">No sign-ups yet.</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-600">
                  <th className="py-1 pr-3 font-normal">Email</th>
                  <th className="py-1 pr-3 font-normal">Design</th>
                  <th className="py-1 pr-3 font-normal">Signed up</th>
                  <th className="py-1 font-normal">Notified</th>
                </tr>
              </thead>
              <tbody>
                {stockNotifications.map((r) => (
                  <tr key={`${r.email}|${r.designSlug}`} className="border-t border-black/[.06]">
                    <td className="py-1.5 pr-3">{r.email}</td>
                    <td className="py-1.5 pr-3">{r.designName}</td>
                    <td className="py-1.5 pr-3">{dateTime.format(new Date(r.createdAt))}</td>
                    <td className="py-1.5">
                      {r.unsubscribedAt ? "Unsubscribed" : r.notifiedAt ? dateTime.format(new Date(r.notifiedAt)) : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {stockCounts.total > LEAD_ROWS_SHOWN && (
          <p className="mt-1 text-xs text-zinc-600">Showing the latest {LEAD_ROWS_SHOWN}; export for all.</p>
        )}
      </section>

      <section data-testid="leads-newsletter" className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Newsletter subscribers</h2>
          <a href="/api/admin/newsletter.csv" className="text-sm underline">
            Export CSV
          </a>
        </div>
        {subscribers.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600">No subscribers yet.</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-600">
                  <th className="py-1 pr-3 font-normal">Email</th>
                  <th className="py-1 pr-3 font-normal">Locale</th>
                  <th className="py-1 pr-3 font-normal">Subscribed</th>
                  <th className="py-1 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((r) => (
                  <tr key={r.email} className="border-t border-black/[.06]">
                    <td className="py-1.5 pr-3">{r.email}</td>
                    <td className="py-1.5 pr-3">{r.locale.toUpperCase()}</td>
                    <td className="py-1.5 pr-3">{dateTime.format(new Date(r.createdAt))}</td>
                    <td className="py-1.5">{r.unsubscribedAt ? "Unsubscribed" : "Active"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {subscriberCounts.total > LEAD_ROWS_SHOWN && (
          <p className="mt-1 text-xs text-zinc-600">Showing the latest {LEAD_ROWS_SHOWN}; export for all.</p>
        )}
      </section>
    </div>
  );
}
