import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, emailSchema, honeypotSchema, localeSchema, noContent, readJsonBody, serverError } from "@/lib/leads/parse";

const newsletterSchema = z.object({
  email: emailSchema,
  locale: localeSchema,
  website: honeypotSchema,
});

// Phase 7 step 4: footer newsletter signup. Same response contract as
// /api/leads/notify. A duplicate clears unsubscribed_at (re-subscribing) and
// refreshes the locale; the unsubscribe_token is left untouched.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) return badRequest();
  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) return badRequest();
  const { email, locale, website } = parsed.data;
  if (website) return noContent();

  const { error } = await createAdminClient()
    .from("newsletter_subscribers")
    .upsert({ email, locale, unsubscribed_at: null }, { onConflict: "email" });
  if (error) {
    console.error("newsletter upsert failed", error.message);
    return serverError();
  }

  return noContent();
}
