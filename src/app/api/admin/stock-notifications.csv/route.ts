import { listStockNotifications } from "@/lib/analytics/leads";
import { requireAdmin } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";

// CSV export of "notify me when it's back" sign-ups (Phase 7 step 5). Same
// admin gate as the catalog export.
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  const rows = await listStockNotifications();
  return csvResponse(
    [
      ["email", "design", "design_slug", "locale", "signed_up_at", "notified_at", "unsubscribed_at"],
      ...rows.map((r) => [
        r.email,
        r.designName,
        r.designSlug,
        r.locale,
        r.createdAt,
        r.notifiedAt ?? "",
        r.unsubscribedAt ?? "",
      ]),
    ],
    "stock-notifications.csv",
  );
}
