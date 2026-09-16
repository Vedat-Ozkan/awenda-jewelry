import { z } from "zod";

// Vars required by the phases landed so far (Phase 1: keepalive; Phase 2:
// Supabase) are required here. Later phases tighten the remaining optional
// ones as each feature lands: Voyage (Phase 3), Stripe (Phase 6), Resend (Phase 9).
const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_EMAILS: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),
  EMBEDDINGS_PROVIDER: z.enum(["voyage", "fake"]).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function parseEnv(): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment variables:\n${messages.join("\n")}`,
    );
  }
  cached = result.data;
  return cached;
}

// Lazy: validated on first property access, not at import time, so `next
// build` (which imports every route module to collect page data) doesn't
// require secrets to be set.
export const env = new Proxy({} as Env, {
  get(_target, prop: keyof Env) {
    return parseEnv()[prop];
  },
});
