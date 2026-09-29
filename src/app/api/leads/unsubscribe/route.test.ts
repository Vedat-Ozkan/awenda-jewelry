import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";

// Unit test — no DB. Each table's update().eq().select() resolves to the
// rows configured in `rowsByTable`. The real update path is covered by
// tests/integration/leads-routes.test.ts.
const rowsByTable: Record<string, { locale: string }[]> = {};
const updateMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: (values: unknown) => {
        updateMock(table, values);
        return { eq: () => ({ select: async () => ({ data: rowsByTable[table] ?? [], error: null }) }) };
      },
    }),
  }),
}));

// next-intl/server's getTranslations() is gated on the `react-server`
// condition (see tests/integration/checkout-route.test.ts); stood in with a
// translator reading the real messages, resolving dotted namespaces.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "en" | "fr"; namespace: string }) => {
    const ns = namespace.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], locale === "fr" ? fr : en);
    return (key: string) => (ns as Record<string, string>)[key] ?? key;
  },
}));

const { GET } = await import("./route");

const TOKEN = "c0000000-0000-4000-8000-000000000001";

function get(query: string, headers: Record<string, string> = {}) {
  return GET(new Request(`http://localhost:3000/api/leads/unsubscribe${query}`, { headers }));
}

describe("GET /api/leads/unsubscribe", () => {
  beforeEach(() => {
    updateMock.mockReset();
    for (const key of Object.keys(rowsByTable)) delete rowsByTable[key];
  });

  it("stock_notifications token -> stamps unsubscribed_at and renders the confirmation in the row's locale", async () => {
    rowsByTable.stock_notifications = [{ locale: "fr" }];
    const res = await get(`?token=${TOKEN}`, { "accept-language": "en-US" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain(fr.leads.unsubscribe.title.replace("'", "&#39;"));
    expect(updateMock).toHaveBeenCalledWith("stock_notifications", { unsubscribed_at: expect.any(String) });
  });

  it("newsletter token -> falls through to the second table", async () => {
    rowsByTable.newsletter_subscribers = [{ locale: "en" }];
    const res = await get(`?token=${TOKEN}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("unsubscribed");
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it("unknown token -> 404 page in the Accept-Language locale", async () => {
    const res = await get(`?token=${TOKEN}`, { "accept-language": "fr-CA,fr;q=0.9" });
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain(fr.leads.unsubscribe.invalidTitle);
  });

  it("missing or malformed token -> 404 and no DB write", async () => {
    expect((await get("")).status).toBe(404);
    expect((await get("?token=nope")).status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
