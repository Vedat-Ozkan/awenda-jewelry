import type { Database } from "@/lib/supabase/database.types";

export type Metal = Database["public"]["Enums"]["metal"];

// Its own module (no server-only imports) so admin server actions and their
// integration tests can build zod enums from it without loading the catalog
// queries in ./index.
export const METALS: [Metal, ...Metal[]] = ["stainless_steel", "sterling_silver"];
