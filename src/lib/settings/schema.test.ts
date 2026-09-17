import { describe, expect, it } from "vitest";
import { formatZodError, settingsSchema, variantPresetsSchema } from "./schema";

const validPresets = {
  ring: ["5", "6", "7"],
  necklace: ["16\"", "18\""],
  chain: ["16\"", "18\""],
  bracelet: ["7\""],
  anklet: ["9\""],
  bangle: ["Small"],
  earring: ["One size"],
  pendant: ["One size"],
};

describe("variantPresetsSchema", () => {
  it("accepts all 8 categories with non-empty label arrays", () => {
    expect(variantPresetsSchema.safeParse(validPresets).success).toBe(true);
  });

  it("rejects a missing category", () => {
    const missingRing: Record<string, string[]> = { ...validPresets };
    delete missingRing.ring;
    expect(variantPresetsSchema.safeParse(missingRing).success).toBe(false);
  });

  it("rejects an empty label array", () => {
    const result = variantPresetsSchema.safeParse({ ...validPresets, ring: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown category key", () => {
    const result = variantPresetsSchema.safeParse({ ...validPresets, watch: ["One size"] });
    expect(result.success).toBe(false);
  });
});

const validSettings = {
  marketName: "Weekly Market",
  marketAddress: "TBD",
  marketWeekday: 6,
  marketOpenTime: "09:00",
  marketCloseTime: "14:00",
  marketTimezone: "America/Toronto",
  marketClosedUntil: null,
  marketClosedNoteEn: "",
  marketClosedNoteFr: "",
  pickupInstructionsEn: "TBD",
  pickupInstructionsFr: "",
  shippingEnabled: true,
  shippingFlatCents: 500,
  freeShippingThresholdCents: 5000,
  stripeTaxEnabled: false,
  variantPresets: validPresets,
};

describe("settingsSchema", () => {
  it("accepts a full valid payload", () => {
    expect(settingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it("rejects an unrecognized timezone", () => {
    const result = settingsSchema.safeParse({ ...validSettings, marketTimezone: "Mars/OlympusMons" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed time", () => {
    const result = settingsSchema.safeParse({ ...validSettings, marketOpenTime: "9am" });
    expect(result.success).toBe(false);
  });

  it("allows a null free shipping threshold", () => {
    const result = settingsSchema.safeParse({ ...validSettings, freeShippingThresholdCents: null });
    expect(result.success).toBe(true);
  });
});

describe("formatZodError", () => {
  it("produces a readable, per-issue message", () => {
    const result = settingsSchema.safeParse({ ...validSettings, variantPresets: {} });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    const message = formatZodError(result.error);
    expect(message).toContain("variantPresets");
  });
});
