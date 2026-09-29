import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Hit every 3 days by the Cloudflare Cron Trigger (see wrangler.jsonc) to keep
// the Supabase Free project from pausing after 7 days of inactivity. Also
// drops analytics events older than 13 months (Phase 7 retention).
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("settings").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 13);
  const { error: purgeError } = await supabase
    .from("analytics_events")
    .delete()
    .lt("occurred_at", cutoff.toISOString());
  if (purgeError) {
    return NextResponse.json({ ok: false, error: purgeError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
