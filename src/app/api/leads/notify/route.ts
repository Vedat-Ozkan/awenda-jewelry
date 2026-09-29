import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, emailSchema, honeypotSchema, localeSchema, noContent, readJsonBody, serverError } from "@/lib/leads/parse";

const notifySchema = z.object({
  email: emailSchema,
  locale: localeSchema,
  designId: z.guid(),
  variantId: z.guid().optional(),
  website: honeypotSchema,
});

// Phase 7 step 4: "Notify me when it's back" on a sold-out design/variant.
// 204 on success, on a duplicate (same email + design) and on a honeypot hit
// (bots get no signal); 400 for a body a real form would never send (bad
// email, oversize, unknown design); 500 only on an unexpected DB failure.
//
// A duplicate re-arms the row (notified_at / unsubscribed_at cleared, locale
// and variant refreshed) rather than being ignored: otherwise someone who was
// already emailed once, or unsubscribed, could never ask again for the same
// design. The unsubscribe_token is left untouched.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) return badRequest();
  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) return badRequest();
  const { email, locale, designId, variantId, website } = parsed.data;
  if (website) return noContent();

  const { error } = await createAdminClient()
    .from("stock_notifications")
    .upsert(
      {
        email,
        design_id: designId,
        variant_id: variantId ?? null,
        locale,
        notified_at: null,
        unsubscribed_at: null,
      },
      { onConflict: "email,design_id" },
    );
  if (error) {
    // 23503 = foreign_key_violation: the design doesn't exist.
    if (error.code === "23503") return badRequest();
    console.error("notify upsert failed", error.message);
    return serverError();
  }

  return noContent();
}
