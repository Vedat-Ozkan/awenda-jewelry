import { z } from "zod";

// Only the vars Phase 1 actually uses (the keepalive route) are required.
// Later phases tighten the optional ones to required as each feature lands:
// Supabase (Phase 2), Voyage (Phase 3), Stripe (Phase 6), Resend (Phase 9).
const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),

  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),
  EMBEDDINGS_PROVIDER: z.enum(["voyage", "fake"]).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment variables:\n${messages.join("\n")}`,
    );
  }
  return result.data;
}

export const env = parseEnv();
