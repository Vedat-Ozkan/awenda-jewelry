import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

// Anon client for storefront reads (public_designs / public_settings, both
// RLS-readable by anon). No cookies needed — the storefront has no user
// session — so this is a plain @supabase/supabase-js client, not the
// @supabase/ssr one used by admin/auth (src/lib/supabase/server.ts).
export function createAnonClient() {
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
