// Shared helpers for the AI-photos batch scripts (Phase 10). Plain Node via
// `tsx` — not part of the app bundle, never shipped to Workers.
//
// Not `@/lib/supabase/admin`: that module imports `server-only`, which throws
// outside a Next.js bundle. The scripts build their own service-role client
// from the env file passed with `--env-file`.
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Supabase = SupabaseClient<Database>;

export const BATCHES_DIR = path.join(process.cwd(), "ai-photos", "batches");

export interface ManifestDesign {
  id: string;
  slug: string;
  name: string;
  category: string;
  metal: string;
  /** Real photos in <batch>/<slug>/, main photo first. */
  photos: string[];
  /** Generated file names in <batch>/<slug>/ — null until generated. */
  studio: string | null;
  model: string | null;
  approved: boolean;
  note: string | null;
}

export interface Manifest {
  createdAt: string;
  supabaseUrl: string;
  designs: ManifestDesign[];
}

export function createScriptClient(): Supabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (use --env-file).");
    process.exit(1);
  }
  // The embedding provider reads `env` from src/lib/env.ts, which validates
  // every required app variable on first access. A minimal
  // .env.production.local only has the four ai-photos variables, so fill the
  // ones the scripts never use.
  for (const [name, value] of [
    ["NEXT_PUBLIC_SITE_URL", "http://localhost"],
    ["CRON_SECRET", "unused"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "unused"],
  ]) {
    process.env[name] ??= value;
  }
  return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Newest batch directory (names sort chronologically: YYYY-MM-DD-HHmm).
export async function newestBatchDir(): Promise<string | null> {
  try {
    const entries = await readdir(BATCHES_DIR, { withFileTypes: true });
    const names = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    return names.length > 0 ? path.join(BATCHES_DIR, names[names.length - 1]) : null;
  } catch {
    return null;
  }
}
