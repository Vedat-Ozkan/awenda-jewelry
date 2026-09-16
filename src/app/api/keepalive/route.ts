import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Hit every 3 days by the Cloudflare Cron Trigger (see wrangler.jsonc) to keep
// the Supabase Free project from pausing after 7 days of inactivity.
// The Supabase query itself is added in Phase 2.
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
