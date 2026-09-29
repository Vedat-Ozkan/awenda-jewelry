import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart } from "@/components/admin/BarChart";
import { bareInputClass, cardClass, chipClass, h1Class, h2Class, mutedClass, primaryButton } from "@/components/admin/ui";
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
    <div data-testid={`tile-${id}`} className="rounded-3xl bg-surface p-4 shadow-[0_1px_0_rgba(30,31,36,0.07)]">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{children}</div>
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
    <section data-testid={`table-${id}`} className={`${cardClass} mt-4`}>
      <h2 className={h2Class}>{title}</h2>
      {rows.length === 0 ? (
        <p className={`${mutedClass} mt-1`}>{empty}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                {headers.map((h, i) => (
                  <th key={h} className={`py-1.5 font-medium ${i > 0 ? "pl-3 text-right" : "pr-3"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-ink/10">
                  {row.map((cell, i) => (
                    <td key={i} className={`py-2.5 ${i > 0 ? "pl-3 text-right tabular-nums" : "pr-3"}`}>
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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className={h1Class}>Analytics</h1>
        <a href={CF_DASHBOARD_URL} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent underline underline-offset-4">
          Cloudflare Web Analytics (traffic detail)
        </a>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {PRESET_DAYS.map((days) => (
          <Link key={days} href={`/admin/analytics?range=${days}`} className={chipClass(range.preset === days)}>
            {days} days
          </Link>
        ))}
      </div>
      <form method="get" className="mt-3 flex flex-wrap items-end gap-2 text-sm">
        <label className="min-w-0 flex-1 basis-36 text-xs font-medium text-muted">
          From
          <input type="date" name="from" defaultValue={range.from} required className={`${bareInputClass} mt-1`} />
        </label>
        <label className="min-w-0 flex-1 basis-36 text-xs font-medium text-muted">
          To
          <input type="date" name="to" defaultValue={range.to} required className={`${bareInputClass} mt-1`} />
        </label>
        <button type="submit" className={`${range.preset === null ? primaryButton : chipClass(false)} h-12`}>
          Apply
        </button>
      </form>
      <p className="mt-3 text-xs text-muted" data-testid="analytics-range">
        {range.from} to {range.to} ({timeZone})
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
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

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
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

      <h2 className="mt-10 font-serif text-2xl font-medium tracking-tight">Leads</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile id="stock-leads" label="Notify-me sign-ups (active / total)">
          {stockCounts.active} / {stockCounts.total}
        </Tile>
        <Tile id="newsletter-leads" label="Newsletter subscribers (active / total)">
          {subscriberCounts.active} / {subscriberCounts.total}
        </Tile>
      </div>

      <section data-testid="leads-stock" className={`${cardClass} mt-4`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={h2Class}>Notify me when it&apos;s back</h2>
          <a href="/api/admin/stock-notifications.csv" className="inline-flex h-11 items-center text-sm font-medium text-accent underline underline-offset-4">
            Export CSV
          </a>
        </div>
        {stockNotifications.length === 0 ? (
          <p className={`${mutedClass} mt-1`}>No sign-ups yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1.5 pr-3 font-medium">Email</th>
                  <th className="py-1.5 pr-3 font-medium">Design</th>
                  <th className="py-1.5 pr-3 font-medium">Signed up</th>
                  <th className="py-1.5 font-medium">Notified</th>
                </tr>
              </thead>
              <tbody>
                {stockNotifications.map((r) => (
                  <tr key={`${r.email}|${r.designSlug}`} className="border-t border-ink/10">
                    <td className="py-2.5 pr-3">{r.email}</td>
                    <td className="py-2.5 pr-3">{r.designName}</td>
                    <td className="py-2.5 pr-3">{dateTime.format(new Date(r.createdAt))}</td>
                    <td className="py-2.5">
                      {r.unsubscribedAt ? "Unsubscribed" : r.notifiedAt ? dateTime.format(new Date(r.notifiedAt)) : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {stockCounts.total > LEAD_ROWS_SHOWN && (
          <p className="mt-1 text-xs text-muted">Showing the latest {LEAD_ROWS_SHOWN}; export for all.</p>
        )}
      </section>

      <section data-testid="leads-newsletter" className={`${cardClass} mt-4`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={h2Class}>Newsletter subscribers</h2>
          <a href="/api/admin/newsletter.csv" className="inline-flex h-11 items-center text-sm font-medium text-accent underline underline-offset-4">
            Export CSV
          </a>
        </div>
        {subscribers.length === 0 ? (
          <p className={`${mutedClass} mt-1`}>No subscribers yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1.5 pr-3 font-medium">Email</th>
                  <th className="py-1.5 pr-3 font-medium">Locale</th>
                  <th className="py-1.5 pr-3 font-medium">Subscribed</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((r) => (
                  <tr key={r.email} className="border-t border-ink/10">
                    <td className="py-2.5 pr-3">{r.email}</td>
                    <td className="py-2.5 pr-3">{r.locale.toUpperCase()}</td>
                    <td className="py-2.5 pr-3">{dateTime.format(new Date(r.createdAt))}</td>
                    <td className="py-2.5">{r.unsubscribedAt ? "Unsubscribed" : "Active"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {subscriberCounts.total > LEAD_ROWS_SHOWN && (
          <p className="mt-1 text-xs text-muted">Showing the latest {LEAD_ROWS_SHOWN}; export for all.</p>
        )}
      </section>
    </div>
  );
}
