import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendPickupReminder } from "@/lib/email/orders";
import { createAdminClient } from "@/lib/supabase/admin";

// Hit daily by the Cloudflare Cron Trigger (see wrangler.jsonc +
// custom-worker.ts) — same `x-cron-secret` guard as /api/keepalive. Also
// triggerable manually in dev: `curl -H 'x-cron-secret: ...'
// localhost:3000/api/cron/pickup-reminders` (README).
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orders, error } = await admin.rpc("pickup_reminder_candidates");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const order of orders ?? []) {
    try {
      await sendPickupReminder(order.id);
    } catch (err) {
      console.error("pickup-reminders cron: email failed", order.id, err);
      continue;
    }
    const { error: updateError } = await admin
      .from("orders")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", order.id);
    if (updateError) {
      console.error("pickup-reminders cron: failed to record reminder_sent_at", order.id, updateError);
      continue;
    }
    sent += 1;
  }

  return NextResponse.json({ sent });
}
