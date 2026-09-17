import { beforeEach, describe, expect, it, vi } from "vitest";

// Hermetic test of the allowlist branch: mocks the admin client (so no real
// Supabase call happens) and the server client's signInWithOtp, and asserts
// that a non-allowlisted address never triggers it. See
// tests/integration/search.test.ts for the same
// vi.mock("@/lib/supabase/admin", ...) pattern and why it's needed (that
// module imports `server-only`, which throws outside a Next.js server
// bundle). @/lib/env is mocked too so this doesn't need the real required
// env vars just to read NEXT_PUBLIC_SITE_URL.
const maybeSingle = vi.fn();
const signInWithOtp = vi.fn();

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithOtp } }),
}));

const { requestMagicLink } = await import("./actions");

describe("requestMagicLink", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    signInWithOtp.mockReset();
  });

  it("returns the generic message and sends no email for an address not in admin_emails", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await requestMagicLink("stranger@example.com");

    expect(result.message).toMatch(/if that address is allowed/i);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a magic link and returns the same message for an allowlisted address", async () => {
    maybeSingle.mockResolvedValue({ data: { email: "owner@example.com" }, error: null });
    signInWithOtp.mockResolvedValue({ error: null });

    const result = await requestMagicLink("Owner@Example.com");

    expect(result.message).toMatch(/if that address is allowed/i);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "owner@example.com",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
        shouldCreateUser: true,
      },
    });
  });
});
