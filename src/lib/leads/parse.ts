import { z } from "zod";
import { isLocale } from "@/i18n/routing";

// Shared by the two lead-capture routes (Phase 7 step 4).
export const MAX_BODY_BYTES = 1024;

// Lower-cased so the (email, design_id) / email unique constraints dedupe
// regardless of how the visitor typed it.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const localeSchema = z.string().refine(isLocale);
// Honeypot: a hidden field real visitors never fill. Any value -> silently
// treated as success without writing anything.
export const honeypotSchema = z.string().max(200).optional();

export const noContent = () => new Response(null, { status: 204 });
export const badRequest = () => new Response(null, { status: 400 });
export const serverError = () => new Response(null, { status: 500 });

// Reads the request body as JSON, or null when it's over the 1 KB cap or not
// JSON. Byte length is measured after reading (the body is at most a few KB
// before we reject it, same as /api/track).
export async function readJsonBody(request: Request): Promise<unknown | null> {
  const text = await request.text().catch(() => "");
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
