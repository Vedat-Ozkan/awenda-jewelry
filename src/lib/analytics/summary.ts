import { z } from "zod";

// Phase 7 step 5. Shape of analytics_summary() (0013_analytics_functions.sql)
// and the date-range handling for /admin/analytics.

export const summarySchema = z.object({
  sessions: z.number(),
  design_views: z.number(),
  add_to_carts: z.number(),
  begin_checkouts: z.number(),
  orders: z.number(),
  revenue_cents: z.number(),
  ship_orders: z.number(),
  pickup_orders: z.number(),
  by_day: z.array(z.object({ day: z.string(), sessions: z.number(), orders: z.number() })),
  revenue_by_week: z.array(z.object({ week: z.string(), revenue_cents: z.number() })),
  top_designs: z.array(z.object({ design_id: z.string(), slug: z.string(), name: z.string(), views: z.number() })),
  sold_out_designs: z.array(z.object({ design_id: z.string(), slug: z.string(), name: z.string(), views: z.number() })),
  referrers: z.array(z.object({ host: z.string(), sessions: z.number() })),
  locales: z.array(z.object({ locale: z.string(), sessions: z.number() })),
  devices: z.array(z.object({ device: z.string(), sessions: z.number() })),
});
export type AnalyticsSummary = z.infer<typeof summarySchema>;

export const PRESET_DAYS = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;
const MAX_CUSTOM_DAYS = 366;

export interface DateRange {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
  // The preset that produced the range, or null for a custom one.
  preset: (typeof PRESET_DAYS)[number] | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | undefined): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// `today` is a YYYY-MM-DD in the market's timezone (the page computes it).
// ?range=7|30|90 -> the last N days ending today; ?from=&to= -> a custom
// range. Anything invalid falls back to the default 30-day preset.
export function resolveRange(params: { range?: string; from?: string; to?: string }, today: string): DateRange {
  const from = parseDate(params.from);
  const to = parseDate(params.to);
  if (from && to && from <= to) {
    const spanDays = (to.getTime() - from.getTime()) / 86_400_000 + 1;
    if (spanDays <= MAX_CUSTOM_DAYS) return { from: params.from!, to: params.to!, preset: null };
  }
  const preset = PRESET_DAYS.find((d) => String(d) === params.range) ?? DEFAULT_DAYS;
  return { from: addDays(today, -(preset - 1)), to: today, preset };
}

// Orders / sessions; 0 when there were no sessions.
export function conversionRate(summary: Pick<AnalyticsSummary, "orders" | "sessions">): number {
  return summary.sessions > 0 ? summary.orders / summary.sessions : 0;
}

export function averageOrderValueCents(summary: Pick<AnalyticsSummary, "orders" | "revenue_cents">): number {
  return summary.orders > 0 ? Math.round(summary.revenue_cents / summary.orders) : 0;
}
