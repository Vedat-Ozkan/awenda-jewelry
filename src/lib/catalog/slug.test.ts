import { describe, expect, it, vi } from "vitest";

// slug.ts also exports uniqueSlug(), which imports
// `@/lib/supabase/admin` — that module imports the `server-only` package,
// which throws unconditionally outside a Next.js server bundle, including
// under Vitest (see tests/integration/search.test.ts for the same pattern).
// Mocked here even though these tests only exercise the pure slugify().
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("not used by these tests");
  },
}));

const { slugify } = await import("./slug");

describe("slugify", () => {
  it("strips FR accents", () => {
    expect(slugify("Collier Été")).toBe("collier-ete");
  });

  it("lower-cases and hyphenates spaces", () => {
    expect(slugify("Gold Ring")).toBe("gold-ring");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugify("Boucles d'Oreilles Anneaux!!")).toBe("boucles-d-oreilles-anneaux");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --Silver Chain--  ")).toBe("silver-chain");
  });
});
