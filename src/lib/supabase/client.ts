import { createBrowserClient } from "@supabase/ssr";

// Browser client, anon key, RLS enforced. Create a new instance per call site.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
