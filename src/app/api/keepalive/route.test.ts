import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keeps this a unit test — no DB. The real DB path is covered by a curl
// against a running `pnpm dev` in the Phase 2 verify step.
const selectMock = vi.fn();
const deleteLtMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ limit: selectMock }),
      delete: () => ({ lt: deleteLtMock }),
    }),
  }),
}));

describe("GET /api/keepalive", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    selectMock.mockResolvedValue({ error: null });
    deleteLtMock.mockResolvedValue({ error: null });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 without the x-cron-secret header", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/keepalive"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with the correct x-cron-secret header", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/keepalive", {
        headers: { "x-cron-secret": "test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 500 when the query fails", async () => {
    selectMock.mockResolvedValue({ error: { message: "db unreachable" } });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/keepalive", {
        headers: { "x-cron-secret": "test-secret" },
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "db unreachable" });
  });

  it("purges analytics events older than 13 months", async () => {
    const { GET } = await import("./route");
    const before = new Date();
    await GET(
      new Request("http://localhost/api/keepalive", {
        headers: { "x-cron-secret": "test-secret" },
      }),
    );
    expect(deleteLtMock).toHaveBeenCalledTimes(1);
    const [column, cutoff] = deleteLtMock.mock.calls[0];
    expect(column).toBe("occurred_at");
    const expected = new Date(before);
    expected.setUTCMonth(expected.getUTCMonth() - 13);
    expect(Math.abs(new Date(cutoff).getTime() - expected.getTime())).toBeLessThan(5_000);
  });

  it("returns 500 when the analytics purge fails", async () => {
    deleteLtMock.mockResolvedValue({ error: { message: "purge failed" } });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/keepalive", {
        headers: { "x-cron-secret": "test-secret" },
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "purge failed" });
  });
});
