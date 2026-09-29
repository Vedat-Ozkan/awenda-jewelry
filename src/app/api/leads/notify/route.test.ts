import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit test — no DB. The real upsert path is covered by
// tests/integration/leads-routes.test.ts.
const upsertMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}));

const { POST } = await import("./route");

const DESIGN = "a0000000-0000-4000-8000-000000000010";
const VARIANT = "b0000000-0000-4000-8000-000000000010";

function post(body: unknown, raw?: string) {
  return POST(
    new Request("http://localhost:3000/api/leads/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

describe("POST /api/leads/notify", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ error: null });
  });

  it("valid body -> 204 and an upsert keyed on (email, design_id) with a normalised email", async () => {
    const res = await post({ email: "  Fan@Example.COM ", locale: "fr", designId: DESIGN, variantId: VARIANT, website: "" });
    expect(res.status).toBe(204);
    expect(upsertMock).toHaveBeenCalledWith(
      { email: "fan@example.com", design_id: DESIGN, variant_id: VARIANT, locale: "fr", notified_at: null, unsubscribed_at: null },
      { onConflict: "email,design_id" },
    );
  });

  it("a duplicate is just another successful upsert -> 204", async () => {
    expect((await post({ email: "a@example.com", locale: "en", designId: DESIGN })).status).toBe(204);
    expect((await post({ email: "a@example.com", locale: "en", designId: DESIGN })).status).toBe(204);
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it("honeypot filled -> 204 and nothing written", async () => {
    const res = await post({ email: "bot@example.com", locale: "en", designId: DESIGN, website: "http://spam.example" });
    expect(res.status).toBe(204);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["bad email", { email: "not-an-email", locale: "en", designId: DESIGN }],
    ["unknown locale", { email: "a@example.com", locale: "de", designId: DESIGN }],
    ["missing design", { email: "a@example.com", locale: "en" }],
    ["design not a uuid", { email: "a@example.com", locale: "en", designId: "nope" }],
  ])("%s -> 400, nothing written", async (_name, body) => {
    expect((await post(body)).status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("body over 1 KB and non-JSON -> 400, nothing written", async () => {
    expect((await post(null, JSON.stringify({ email: "a@example.com", locale: "en", designId: DESIGN, pad: "x".repeat(1100) }))).status).toBe(400);
    expect((await post(null, "not json")).status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("unknown design (FK violation) -> 400; other DB errors -> 500", async () => {
    upsertMock.mockResolvedValueOnce({ error: { code: "23503", message: "fk" } });
    expect((await post({ email: "a@example.com", locale: "en", designId: DESIGN })).status).toBe(400);
    upsertMock.mockResolvedValueOnce({ error: { code: "XX000", message: "boom" } });
    expect((await post({ email: "a@example.com", locale: "en", designId: DESIGN })).status).toBe(500);
  });
});
