import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit test — no DB. The real insert path is covered by
// tests/integration/track-route.test.ts.
const insertMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: insertMock }) }),
}));

const { POST } = await import("./route");

const SESSION = "6f1c2a3e-1111-4222-8333-444455556666";
const DESIGN = "a0000000-0000-4000-8000-000000000001";

function post(body: unknown, headers: Record<string, string> = {}, raw?: string) {
  return POST(
    new Request("http://localhost:3000/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

describe("POST /api/track", () => {
  beforeEach(() => {
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it("valid event -> 204 and one row with derived referrer_host and device", async () => {
    const res = await post(
      { event: "page_view", sessionId: SESSION, locale: "fr", path: "/fr", referrer: "https://www.google.com/search?q=x" },
      { "sec-ch-ua-mobile": "?1" },
    );
    expect(res.status).toBe(204);
    expect(insertMock).toHaveBeenCalledWith({
      event: "page_view",
      session_id: SESSION,
      locale: "fr",
      path: "/fr",
      design_id: null,
      variant_id: null,
      referrer_host: "www.google.com",
      device: "mobile",
    });
  });

  it("drops path on non-page_view events, ignores unknown keys, falls back to the UA for device", async () => {
    const res = await post(
      { event: "design_view", sessionId: SESSION, locale: "en", path: "/en/p/x", designId: DESIGN, email: "a@b.c" },
      { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    );
    expect(res.status).toBe(204);
    const row = insertMock.mock.calls[0][0];
    expect(row).toMatchObject({ event: "design_view", path: null, design_id: DESIGN, device: "desktop" });
    expect(row).not.toHaveProperty("email");
  });

  it("does not record the site's own host as a referrer", async () => {
    await post({ event: "page_view", sessionId: SESSION, locale: "en", path: "/en", referrer: "http://localhost:3000/en/cart" });
    expect(insertMock.mock.calls[0][0].referrer_host).toBeNull();
  });

  it.each([
    ["unknown event", { event: "purchase", sessionId: SESSION, locale: "en" }],
    ["bad locale", { event: "page_view", sessionId: SESSION, locale: "de" }],
    ["bad designId", { event: "design_view", sessionId: SESSION, locale: "en", designId: "nope" }],
    ["path over 200 chars", { event: "page_view", sessionId: SESSION, locale: "en", path: "/" + "a".repeat(200) }],
    ["missing sessionId", { event: "page_view", locale: "en" }],
  ])("invalid body (%s) -> 204 and no row", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(204);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("non-JSON body -> 204 and no row", async () => {
    const res = await post(null, {}, "not json");
    expect(res.status).toBe(204);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("body over 1 KB -> 204 and no row", async () => {
    const res = await post({ event: "page_view", sessionId: SESSION, locale: "en", referrer: "x", pad: "y".repeat(1100) });
    expect(res.status).toBe(204);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("insert failure -> still 204", async () => {
    insertMock.mockResolvedValue({ error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ event: "page_view", sessionId: SESSION, locale: "en", path: "/en" });
    expect(res.status).toBe(204);
  });
});
