import { describe, expect, it } from "vitest";
import { localize } from "./localize";

const base = {
  name_en: "Gold Ring",
  name_fr: null as string | null,
  description_en: "A gold ring.",
  description_fr: null as string | null,
  material_en: "Gold",
  material_fr: null as string | null,
};

describe("localize", () => {
  it("returns the English fields on the en locale, even when FR is set", () => {
    const row = { ...base, name_fr: "Bague en Or", description_fr: "Une bague en or." };
    expect(localize(row, "en")).toEqual({ name: "Gold Ring", description: "A gold ring.", material: "Gold" });
  });

  it("returns the French fields on the fr locale when present", () => {
    const row = { ...base, name_fr: "Bague en Or", description_fr: "Une bague en or.", material_fr: "Or" };
    expect(localize(row, "fr")).toEqual({ name: "Bague en Or", description: "Une bague en or.", material: "Or" });
  });

  it("falls back to English on the fr locale when FR fields are null", () => {
    expect(localize(base, "fr")).toEqual({ name: "Gold Ring", description: "A gold ring.", material: "Gold" });
  });
});
