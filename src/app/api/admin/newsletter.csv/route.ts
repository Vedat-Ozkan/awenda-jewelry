import { listNewsletterSubscribers } from "@/lib/analytics/leads";
import { requireAdmin } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";

// CSV export of newsletter subscribers (Phase 7 step 5). Includes
// unsubscribed rows with their timestamp so the owner can filter them out.
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  const rows = await listNewsletterSubscribers();
  return csvResponse(
    [
      ["email", "locale", "subscribed_at", "unsubscribed_at"],
      ...rows.map((r) => [r.email, r.locale, r.createdAt, r.unsubscribedAt ?? ""]),
    ],
    "newsletter.csv",
  );
}
