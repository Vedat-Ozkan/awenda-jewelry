import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit test — no DB. A chainable stand-in for the Supabase query builder:
// every method returns the builder, awaiting it yields the table's canned
// result. The real restock -> email -> notified_at path is covered by
// tests/integration/back-in-stock.test.ts.
type Result = { data: unknown; error: unknown };
const results: Record<string, Result> = {};
const updates: { table: string; values: Record<string, unknown>; id?: unknown }[] = [];

function builder(table: string) {
  const b: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return (resolve: (r: Result) => void) => resolve(results[table]);
        if (prop === "update") {
          return (values: Record<string, unknown>) => {
            const entry = { table, values } as (typeof updates)[number];
            updates.push(entry);
            return { eq: (_col: string, id: unknown) => ((entry.id = id), Promise.resolve({ error: null })) };
          };
        }
        return () => b;
      },
    },
  );
  return b;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: builder }) }));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendEmail: sendEmailMock }));

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "x");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "x");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "x");

const { sendBackInStockNotices } = await import("./leads");

const D1 = "a0000000-0000-4000-8000-0000000000a1";
const D2 = "a0000000-0000-4000-8000-0000000000a2";
const TOKEN = "c0000000-0000-4000-8000-000000000002";

describe("sendBackInStockNotices", () => {
  beforeEach(() => {
    updates.length = 0;
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
    results.stock_notifications = {
      error: null,
      data: [
        { id: "n1", email: "en@example.com", locale: "en", unsubscribe_token: TOKEN, design_id: D1 },
        { id: "n2", email: "fr@example.com", locale: "fr", unsubscribe_token: TOKEN, design_id: D1 },
        { id: "n3", email: "other@example.com", locale: "en", unsubscribe_token: TOKEN, design_id: D2 },
      ],
    };
    results.designs = {
      error: null,
      data: [
        { id: D1, slug: "ring-one", name_en: "Ring One", name_fr: "Bague Un" },
        { id: D2, slug: "ring-two", name_en: "Ring Two", name_fr: null },
      ],
    };
    results.variants = { error: null, data: [{ design_id: D1 }] }; // D2 has no stock
  });

  it("emails each pending row of a design that is active and in stock, then stamps notified_at", async () => {
    const sent = await sendBackInStockNotices([D1, D2]);

    expect(sent).toBe(2);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const [en, fr] = sendEmailMock.mock.calls.map((c) => c[0]);
    expect(en).toMatchObject({ to: "en@example.com", subject: "Ring One is back in stock — Awenda Jewelry" });
    expect(fr).toMatchObject({ to: "fr@example.com", subject: "Bague Un est de retour — Awenda Jewelry" });
    expect(en.react.props).toMatchObject({
      locale: "en",
      designUrl: "http://localhost:3000/en/p/ring-one",
      unsubscribeUrl: `http://localhost:3000/api/leads/unsubscribe?token=${TOKEN}`,
    });
    expect(fr.react.props.designUrl).toBe("http://localhost:3000/fr/p/ring-one");
    expect(updates.map((u) => [u.table, u.id])).toEqual([
      ["stock_notifications", "n1"],
      ["stock_notifications", "n2"],
    ]);
    expect(updates[0].values.notified_at).toEqual(expect.any(String));
  });

  it("a failed send is not stamped and does not stop the others", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("resend down"));
    const sent = await sendBackInStockNotices([D1]);

    expect(sent).toBe(1);
    expect(updates.map((u) => u.id)).toEqual(["n2"]);
  });

  it("no pending rows -> no email", async () => {
    results.stock_notifications = { error: null, data: [] };
    expect(await sendBackInStockNotices([D1])).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
