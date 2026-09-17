import { afterAll, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "../helpers/local-supabase";

// Phase 4 step 9. Same mocking pattern as tests/integration/catalog-actions.test.ts:
// `@/lib/supabase/admin` imports `server-only` (throws outside a Next.js
// server bundle), `@/lib/auth`'s requireAdminFromCookies() reads cookies via
// next/headers (unavailable outside a request context), and revalidatePath()
// needs a render context that doesn't exist under Vitest.

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));
vi.mock("@/lib/auth", () => ({
  requireAdminFromCookies: async () => ({ user: { email: "admin@example.com" }, email: "admin@example.com" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: vi.fn() }));

const { saveSettings } = await import("@/app/(admin)/admin/(shell)/settings/actions");

// Exactly supabase/seed.sql's settings row (id=1) — must round-trip
// unchanged so tests that overwrite variant_presets don't leak a different
// shape into other tests/e2e specs sharing the same local Supabase instance
// (e.g. the new-design flow's category preset chips).
const SEEDED_PRESETS = {
  ring: ["5", "6", "7", "8", "9", "10"],
  necklace: ["16\"", "18\"", "20\"", "24\""],
  chain: ["16\"", "18\"", "20\"", "24\""],
  bracelet: ["6.5\"", "7\"", "7.5\"", "8\""],
  anklet: ["9\"", "10\""],
  bangle: ["Small", "Medium", "Large"],
  earring: ["One size"],
  pendant: ["One size"],
};

function seededPayload(overrides: Partial<Parameters<typeof saveSettings>[0]> = {}) {
  return {
    marketName: "Weekly Market",
    marketAddress: "TBD",
    marketWeekday: 6,
    marketOpenTime: "09:00",
    marketCloseTime: "14:00",
    marketTimezone: "America/New_York",
    marketClosedUntil: null,
    marketClosedNoteEn: "",
    marketClosedNoteFr: "",
    pickupInstructionsEn: "TBD",
    pickupInstructionsFr: "À déterminer",
    shippingEnabled: false,
    shippingFlatCents: 500,
    freeShippingThresholdCents: 5000,
    stripeTaxEnabled: false,
    variantPresets: SEEDED_PRESETS,
    ...overrides,
  };
}

describe("saveSettings", () => {
  const supabase = createServiceClient();

  // Restore the exact seeded row (supabase/seed.sql) so this test doesn't
  // leak into others that read `settings`.
  afterAll(async () => {
    await saveSettings(seededPayload());
  });

  it("updates the settings row", async () => {
    await saveSettings(seededPayload({ shippingFlatCents: 700 }));

    const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
    expect(data?.shipping_flat_cents).toBe(700);
    expect(data?.market_name).toBe("Weekly Market");
    expect(data?.variant_presets).toEqual(SEEDED_PRESETS);
  });

  it("stores a null free shipping threshold when left blank", async () => {
    await saveSettings(seededPayload({ freeShippingThresholdCents: null }));

    const { data } = await supabase.from("settings").select("free_shipping_threshold_cents").eq("id", 1).single();
    expect(data?.free_shipping_threshold_cents).toBeNull();
  });

  it("rejects invalid variant presets with a readable error", async () => {
    await expect(saveSettings(seededPayload({ variantPresets: { ring: [] } as never }))).rejects.toThrow(
      /variantPresets/,
    );
  });

  it("rejects an unrecognized timezone", async () => {
    await expect(saveSettings(seededPayload({ marketTimezone: "Not/AZone" }))).rejects.toThrow(/marketTimezone/);
  });
});
