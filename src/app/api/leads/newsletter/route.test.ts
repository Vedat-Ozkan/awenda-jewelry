import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit test — no DB. The real upsert path is covered by
// tests/integration/leads-routes.test.ts.
const upsertMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}));

const { POST } = await import("./route");

function post(body: unknown, raw?: string) {
  return POST(
    new Request("http://localhost:3000/api/leads/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

describe("POST /api/leads/newsletter", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ error: null });
  });

  it("valid body -> 204 and an upsert keyed on email with a normalised address", async () => {
    const res = await post({ email: "Reader@Example.com", locale: "fr", website: "" });
    expect(res.status).toBe(204);
    expect(upsertMock).toHaveBeenCalledWith(
      { email: "reader@example.com", locale: "fr", unsubscribed_at: null },
      { onConflict: "email" },
    );
  });

  it("honeypot filled -> 204 and nothing written", async () => {
    const res = await post({ email: "bot@example.com", locale: "en", website: "x" });
    expect(res.status).toBe(204);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("invalid email, unknown locale, oversize and non-JSON bodies -> 400, nothing written", async () => {
    expect((await post({ email: "nope", locale: "en" })).status).toBe(400);
    expect((await post({ email: "a@example.com", locale: "es" })).status).toBe(400);
    expect((await post(null, JSON.stringify({ email: "a@example.com", locale: "en", pad: "x".repeat(1100) }))).status).toBe(400);
    expect((await post(null, "{")).status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("DB error -> 500", async () => {
    upsertMock.mockResolvedValueOnce({ error: { code: "XX000", message: "boom" } });
    expect((await post({ email: "a@example.com", locale: "en" })).status).toBe(500);
  });
});
