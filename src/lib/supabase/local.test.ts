import { describe, expect, it } from "vitest";
import { getSupabaseEnv } from "../../../tests/helpers/local-supabase";

// Integration smoke test: proves the local Supabase stack (`pnpm supabase start`)
// is reachable.
describe("local Supabase", () => {
  it("REST endpoint is reachable", async () => {
    const { API_URL, ANON_KEY } = getSupabaseEnv();
    expect(API_URL).toBeTruthy();
    expect(ANON_KEY).toBeTruthy();

    const res = await fetch(`${API_URL}/rest/v1/`, {
      headers: { apikey: ANON_KEY },
    });
    expect(res.status).toBe(200);
  });
});
