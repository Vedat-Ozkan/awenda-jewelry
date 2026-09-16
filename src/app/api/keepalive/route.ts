import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Hit every 3 days by the Cloudflare Cron Trigger (see wrangler.jsonc) to keep
// the Supabase Free project from pausing after 7 days of inactivity.
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { error } = await createAdminClient().from("settings").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
