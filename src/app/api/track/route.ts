import { z } from "zod";
import { isLocale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BODY_BYTES = 1024;

// Phase 7 step 3. Body shape = the phase file's plus an optional `referrer`
// (document.referrer, sent once per session on the first page_view): the
// request's own `Referer` header is always the page that sent the beacon, so
// it can never say where the visitor came from. Only the hostname is kept.
const trackSchema = z.object({
  event: z.enum(["page_view", "design_view", "add_to_cart", "begin_checkout"]),
  sessionId: z.string().regex(/^[\w-]{8,64}$/),
  locale: z.string().refine(isLocale),
  path: z.string().max(200).optional(),
  designId: z.guid().optional(),
  variantId: z.guid().optional(),
  referrer: z.string().max(200).optional(),
});

function referrerHost(referrer: string | undefined, requestUrl: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname;
    // Internal navigation isn't a referrer worth counting.
    return host && host !== new URL(requestUrl).hostname ? host : null;
  } catch {
    return null;
  }
}

function deviceFrom(headers: Headers): "mobile" | "desktop" {
  const hint = headers.get("sec-ch-ua-mobile");
  if (hint === "?1") return "mobile";
  if (hint === "?0") return "desktop";
  return /Mobi|Android|iPhone|iPad/i.test(headers.get("user-agent") ?? "") ? "mobile" : "desktop";
}

// Always answers 204: the beacon can't act on a response, and a rejected or
// failed event must never surface as a client error. Invalid bodies, oversize
// bodies and insert failures are dropped silently.
export async function POST(request: Request) {
  const noContent = () => new Response(null, { status: 204 });

  const text = await request.text().catch(() => "");
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return noContent();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return noContent();
  }
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) return noContent();
  const { event, sessionId, locale, path, designId, variantId, referrer } = parsed.data;

  const { error } = await createAdminClient()
    .from("analytics_events")
    .insert({
      event,
      session_id: sessionId,
      locale,
      path: event === "page_view" ? (path ?? null) : null,
      design_id: designId ?? null,
      variant_id: variantId ?? null,
      referrer_host: referrerHost(referrer, request.url),
      device: deviceFrom(request.headers),
    });
  if (error) console.error("track insert failed", error.message);

  return noContent();
}
