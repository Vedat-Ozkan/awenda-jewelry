import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Integration smoke test: proves the local Supabase stack (`pnpm supabase start`)
// is reachable. Reads the URL/key from `supabase status -o env` rather than
// hardcoding the local ports.
function getSupabaseEnv() {
  const output = execSync("pnpm supabase status -o env", {
    encoding: "utf8",
  });
  const env: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const match = line.match(/^(\w+)="(.*)"$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

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
