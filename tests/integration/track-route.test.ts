import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createServiceClient, getSupabaseEnv } from "../helpers/local-supabase";

// Env schema (src/lib/env.ts) validates every var on first access — same
// setup as tests/integration/checkout-route.test.ts.
const { API_URL, ANON_KEY } = getSupabaseEnv();
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", API_URL);
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

// `@/lib/supabase/admin` imports `server-only`, which throws outside a Next.js
// bundle — swapped for the local service-role client (same pattern as search.test.ts).
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));

const { POST } = await import("@/app/api/track/route");
const service = createServiceClient();
const sessionId = randomUUID();

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", "sec-ch-ua-mobile": "?0" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/track (real DB)", () => {
  afterAll(async () => {
    await service.from("analytics_events").delete().eq("session_id", sessionId);
  });

  it("valid event -> 204 and a row; invalid event -> 204 and no row", async () => {
    const { data: design } = await service.from("designs").select("id").eq("slug", "silver-necklace-16").single();

    const ok = await post({ event: "design_view", sessionId, locale: "en", designId: design!.id });
    expect(ok.status).toBe(204);
    const bad = await post({ event: "nope", sessionId, locale: "en" });
    expect(bad.status).toBe(204);

    const { data: rows } = await service.from("analytics_events").select("*").eq("session_id", sessionId);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ event: "design_view", design_id: design!.id, locale: "en", device: "desktop" });
  });
});
