import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Reads connection details for the local Supabase stack (`pnpm supabase
// start`) from `supabase status -o env` rather than hardcoding local ports.
export function getSupabaseEnv() {
  const output = execSync("pnpm supabase status -o env", {
    encoding: "utf8",
  });
  const env: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const match = line.match(/^(\w+)="(.*)"$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

// Service-role client — bypasses RLS. For integration tests that set up or
// assert on data directly.
export function createServiceClient() {
  const { API_URL, SERVICE_ROLE_KEY } = getSupabaseEnv();
  return createClient<Database>(API_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Anon client — RLS enforced, as an unauthenticated storefront visitor would see it.
export function createAnonClient() {
  const { API_URL, ANON_KEY } = getSupabaseEnv();
  return createClient<Database>(API_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
