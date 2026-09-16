import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/keepalive", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("CRON_SECRET", "test-secret");
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
  });
});
