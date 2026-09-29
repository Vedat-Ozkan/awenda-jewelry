import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { createServiceClient, getSupabaseEnv } from "../helpers/local-supabase";

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

// Phase 6 step 8. Same createAdminClient-swap pattern as
// tests/integration/stripe-webhook.test.ts, but the admin client is wrapped
// so calls to pickup_reminder_candidates() pin `p_today` (see
// 0010_pickup_reminders.sql) to a date this test computes — never real
// "now". That sidesteps settings.market_weekday entirely: unlike
// tests/integration/settings-actions.test.ts, which mutates the same
// shared settings row (id=1) and runs concurrently under Vitest's default
// per-file parallelism, this test never writes to `settings`, so there's
// nothing to race.
//
// sendPickupReminder is mocked rather than exercised for real:
// src/lib/email/orders.tsx's sendEmail() ultimately writes to the shared
// tmp/emails/ directory (src/lib/email/capture.ts), and
// tests/integration/stripe-webhook.test.ts clears that same directory and
// asserts an exact file count in its own beforeEach/it pairs — a real send
// from this file landing in that narrow window intermittently inflated its
// count. Mocking the boundary (like checkout-route.test.ts mocks Stripe)
// verifies the route calls sendPickupReminder for the right order(s)
// without touching that shared resource at all.
const { API_URL, SERVICE_ROLE_KEY } = getSupabaseEnv();
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", API_URL);
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
vi.stubEnv("RESEND_API_KEY", "");

const pinnedToday = { value: "" };
const prefix = `test-pickup-reminder-${randomUUID().slice(0, 8)}`;
const sessionIdPrefix = `cs_test_${prefix}`;

vi.mock("@/lib/supabase/admin", () => ({
  // Real Supabase client methods (`.from`, `.rpc`, ...) are prototype
  // methods, not arrow-function instance fields, so a `{ ...real, rpc:
  // override }` spread silently drops everything but `rpc`'s own-enumerable
  // presence (breaks `.from`, used right after by sendPickupReminder's own
  // createAdminClient() call). A Proxy forwards every other method to the
  // real client bound to itself, and only rewrites `rpc`.
  //
  // pickup_reminder_candidates() is intentionally an unscoped table scan
  // (production wants every real order) — but other integration test files
  // running concurrently under Vitest's default per-file parallelism also
  // insert `status: 'awaiting_pickup'` orders of their own, which the real
  // scan would catch too, both sending them a stray reminder email and
  // inflating this test's own `sent` count. The candidate rows are filtered
  // down to this test's own fixtures (by `stripe_checkout_session_id`
  // prefix) after the real RPC call, so the route only ever processes this
  // test's own orders — the SQL selection logic itself is still exercised
  // for real, just not its production-scale scope.
  createAdminClient: () => {
    const real = createServiceClient();
    return new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === "rpc") {
          return async (fn: Parameters<typeof real.rpc>[0], args?: Record<string, unknown>) => {
            if (fn !== "pickup_reminder_candidates") return target.rpc(fn, args as never);
            const result = await target.rpc(fn, { p_today: pinnedToday.value, ...args });
            if (result.error) return result;
            return {
              ...result,
              data: (result.data ?? []).filter((order) => order.stripe_checkout_session_id.startsWith(sessionIdPrefix)),
            };
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  },
}));

const sendPickupReminderMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/orders", () => ({ sendPickupReminder: (orderId: string) => sendPickupReminderMock(orderId) }));

const { GET } = await import("@/app/api/cron/pickup-reminders/route");

const supabase = createServiceClient();

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Finds a date (as "today") whose next calendar day falls on
// `targetWeekday` — read-only against `settings.market_weekday`, never
// written. Once p_today is passed explicitly, pickup_reminder_candidates()
// does plain calendar-date arithmetic on it (no further timezone
// conversion — market_timezone only matters for the real "now" default), so
// this stays in UTC calendar dates throughout to match exactly.
function todayBeforeWeekday(targetWeekday: number): string {
  const base = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offset));
    const tomorrow = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate() + 1));
    if (tomorrow.getUTCDay() === targetWeekday) return toDateString(candidate);
  }
  throw new Error(`No date found with tomorrow on weekday ${targetWeekday}`);
}

function request(secret?: string): Request {
  return new Request("http://localhost/api/cron/pickup-reminders", {
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

function orderRow(overrides: Partial<OrderInsert> & Pick<OrderInsert, "status">): OrderInsert {
  return {
    stripe_checkout_session_id: `${sessionIdPrefix}-${randomUUID().slice(0, 8)}`,
    fulfillment: "pickup",
    locale: "en",
    customer_email: `${randomUUID().slice(0, 8)}@example.com`,
    subtotal_cents: 1800,
    shipping_cents: 0,
    tax_cents: 0,
    total_cents: 1800,
    ...overrides,
  };
}

afterAll(async () => {
  await supabase.from("orders").delete().like("stripe_checkout_session_id", `${sessionIdPrefix}%`);
});

describe("GET /api/cron/pickup-reminders", () => {
  it("returns 401 without the x-cron-secret header", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("emails and marks the awaiting-pickup order due tomorrow; skips an already-reminded order and a shipped order; a second run sends nothing", async () => {
    // market_weekday is only read, never mutated (see the top-of-file
    // note) — whatever the seed currently has is fine.
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("market_weekday")
      .eq("id", 1)
      .single();
    if (settingsError) throw settingsError;
    pinnedToday.value = todayBeforeWeekday(settings!.market_weekday!);

    const { data: due, error: dueError } = await supabase
      .from("orders")
      .insert(orderRow({ status: "awaiting_pickup" }))
      .select("*")
      .single();
    if (dueError) throw dueError;

    const { data: alreadyReminded, error: remindedError } = await supabase
      .from("orders")
      .insert(orderRow({ status: "awaiting_pickup", reminder_sent_at: new Date().toISOString() }))
      .select("*")
      .single();
    if (remindedError) throw remindedError;

    const { data: shipped, error: shippedError } = await supabase
      .from("orders")
      .insert(orderRow({ status: "shipped", fulfillment: "ship" }))
      .select("*")
      .single();
    if (shippedError) throw shippedError;

    const first = await GET(request("test-secret"));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ sent: 1 });

    const { data: dueAfter } = await supabase.from("orders").select("reminder_sent_at").eq("id", due!.id).single();
    expect(dueAfter?.reminder_sent_at).not.toBeNull();

    const { data: remindedAfter } = await supabase
      .from("orders")
      .select("reminder_sent_at")
      .eq("id", alreadyReminded!.id)
      .single();
    expect(remindedAfter?.reminder_sent_at).toBe(alreadyReminded!.reminder_sent_at);

    const { data: shippedAfter } = await supabase.from("orders").select("reminder_sent_at").eq("id", shipped!.id).single();
    expect(shippedAfter?.reminder_sent_at).toBeNull();

    expect(sendPickupReminderMock).toHaveBeenCalledExactlyOnceWith(due!.id);

    const second = await GET(request("test-secret"));
    expect(await second.json()).toEqual({ sent: 0 });
    expect(sendPickupReminderMock).toHaveBeenCalledOnce(); // still just the one call from the first run
  });
});
