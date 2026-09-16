// Upserts ADMIN_EMAILS into the admin_emails table. Run once per environment
// after `pnpm db:reset` (or against a hosted project) so `is_admin()` works.
//
// `src/lib/supabase/admin.ts` imports the `server-only` package, which throws
// unconditionally when its main entrypoint is loaded outside a Next.js
// server bundle (see its package.json — "main" always throws; only bundlers
// that honour the "react-server" export condition get the no-op). Running
// this script directly with `node`/`tsx` hits that throw, so it builds its
// own service-role client inline instead of importing admin.ts.
import { createClient } from "@supabase/supabase-js";

const required = ["ADMIN_EMAILS", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const emails = process.env.ADMIN_EMAILS!.split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (emails.length === 0) {
  console.error("ADMIN_EMAILS is set but contains no emails");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { error } = await supabase
  .from("admin_emails")
  .upsert(
    emails.map((email) => ({ email })),
    { onConflict: "email" },
  );

if (error) {
  console.error("Failed to seed admin emails:", error.message);
  process.exit(1);
}

console.log(`Seeded ${emails.length} admin email(s): ${emails.join(", ")}`);
