import "server-only";
import { fetchAllPages } from "@/lib/analytics/paging";
import { createClient } from "@/lib/supabase/server";

// Phase 7 step 5: lead lists for /admin/analytics and their CSV exports.
// RLS-enforced cookie client: the is_admin() select policies on these tables
// (0012_analytics.sql) are the gate, so a non-admin gets no rows. Design names come from a second
// query + manual join, same pattern as the catalog CSV export.

export interface StockNotificationRow {
  email: string;
  designName: string;
  designSlug: string;
  locale: string;
  createdAt: string;
  notifiedAt: string | null;
  unsubscribedAt: string | null;
}

export interface NewsletterRow {
  email: string;
  locale: string;
  createdAt: string;
  unsubscribedAt: string | null;
}

export interface LeadCounts {
  total: number;
  active: number;
}

// Exact counts (head requests, no rows transferred), so they stay right past
// PostgREST's 1000-row cap.
async function countLeads(table: "stock_notifications" | "newsletter_subscribers"): Promise<LeadCounts> {
  const supabase = await createClient();
  const [total, active] = await Promise.all([
    supabase.from(table).select("id", { count: "exact", head: true }),
    supabase.from(table).select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
  ]);
  if (total.error) throw total.error;
  if (active.error) throw active.error;
  return { total: total.count ?? 0, active: active.count ?? 0 };
}

export const countStockNotifications = () => countLeads("stock_notifications");
export const countNewsletterSubscribers = () => countLeads("newsletter_subscribers");

// With `limit`: the latest N rows (page tables). Without: every row, read in
// .range() pages (CSV exports).
export async function listStockNotifications(limit?: number): Promise<StockNotificationRow[]> {
  const supabase = await createClient();
  const select = () =>
    supabase
      .from("stock_notifications")
      .select("email, design_id, locale, created_at, notified_at, unsubscribed_at")
      .order("created_at", { ascending: false })
      .order("id");
  let rows;
  if (limit) {
    const { data, error } = await select().limit(limit);
    if (error) throw error;
    rows = data;
  } else {
    rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await select().range(from, to);
      if (error) throw error;
      return data;
    });
  }

  const designIds = [...new Set(rows.map((r) => r.design_id))];
  const { data: designs, error: designsError } =
    designIds.length > 0
      ? await supabase.from("designs").select("id, slug, name_en").in("id", designIds)
      : { data: [], error: null };
  if (designsError) throw designsError;
  const designById = new Map(designs.map((d) => [d.id, d]));

  return rows.map((r) => ({
    email: r.email,
    designName: designById.get(r.design_id)?.name_en ?? "(deleted design)",
    designSlug: designById.get(r.design_id)?.slug ?? "",
    locale: r.locale,
    createdAt: r.created_at,
    notifiedAt: r.notified_at,
    unsubscribedAt: r.unsubscribed_at,
  }));
}

export async function listNewsletterSubscribers(limit?: number): Promise<NewsletterRow[]> {
  const supabase = await createClient();
  const select = () =>
    supabase
      .from("newsletter_subscribers")
      .select("email, locale, created_at, unsubscribed_at")
      .order("created_at", { ascending: false })
      .order("id");
  let rows;
  if (limit) {
    const { data, error } = await select().limit(limit);
    if (error) throw error;
    rows = data;
  } else {
    rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await select().range(from, to);
      if (error) throw error;
      return data;
    });
  }
  return rows.map((r) => ({
    email: r.email,
    locale: r.locale,
    createdAt: r.created_at,
    unsubscribedAt: r.unsubscribed_at,
  }));
}
