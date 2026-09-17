import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

// Settings page (Phase 4 step 9): the single `settings` row (id = 1), read
// via the cookie client (settings_admin_all RLS policy). next_market_date()
// is anon-callable (0003_functions.sql), so the cookie client can call it
// directly rather than going through the admin client.
export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const { data: settings, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;

  const { data: nextMarketDate, error: nextMarketDateError } = await supabase.rpc("next_market_date");
  if (nextMarketDateError) throw nextMarketDateError;

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Next market date: {nextMarketDate ?? "Not configured"}
      </p>
      <SettingsForm settings={settings} />
    </div>
  );
}
