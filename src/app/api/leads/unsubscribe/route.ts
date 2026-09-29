import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isLocale, routing, type Locale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";

const tokenSchema = z.guid();

function localeFromHeader(header: string | null): Locale {
  const preferred = (header ?? "").split(",")[0]?.trim().slice(0, 2).toLowerCase() ?? "";
  return isLocale(preferred) ? preferred : routing.defaultLocale;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Plain, unstyled-by-design confirmation page: it is opened from an email
// link, not navigated to within the storefront.
function page(locale: Locale, title: string, body: string, status: number): Response {
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>
<body style="font-family: Georgia, serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #1c1a17; background: #faf6ef;">
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(body)}</p>
</body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

// Phase 7 step 4: GET /api/leads/unsubscribe?token=<uuid>. The token belongs
// to exactly one stock_notifications or newsletter_subscribers row (uuid
// collisions across tables are not a practical concern); that row is stamped
// unsubscribed_at and the page is rendered in the row's stored locale.
// Idempotent: reopening the link re-confirms. An unknown or malformed token
// gets a 404 page in the browser's Accept-Language locale.
export async function GET(request: Request) {
  const token = tokenSchema.safeParse(new URL(request.url).searchParams.get("token"));
  const fallbackLocale = localeFromHeader(request.headers.get("accept-language"));

  if (token.success) {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    for (const table of ["stock_notifications", "newsletter_subscribers"] as const) {
      const { data, error } = await admin
        .from(table)
        .update({ unsubscribed_at: now })
        .eq("unsubscribe_token", token.data)
        .select("locale");
      if (error) {
        console.error("unsubscribe failed", error.message);
        const t = await getTranslations({ locale: fallbackLocale, namespace: "leads.unsubscribe" });
        return page(fallbackLocale, t("errorTitle"), t("errorBody"), 500);
      }
      if (data && data.length > 0) {
        const locale = isLocale(data[0].locale) ? data[0].locale : fallbackLocale;
        const t = await getTranslations({ locale, namespace: "leads.unsubscribe" });
        return page(locale, t("title"), t("body"), 200);
      }
    }
  }

  const t = await getTranslations({ locale: fallbackLocale, namespace: "leads.unsubscribe" });
  return page(fallbackLocale, t("invalidTitle"), t("invalidBody"), 404);
}
