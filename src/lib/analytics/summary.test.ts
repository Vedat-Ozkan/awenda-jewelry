import { describe, expect, it } from "vitest";
import { averageOrderValueCents, conversionRate, resolveRange } from "./summary";

describe("resolveRange", () => {
  const today = "2026-09-28";

  it("defaults to the last 30 days, inclusive of today", () => {
    expect(resolveRange({}, today)).toEqual({ from: "2026-08-30", to: today, preset: 30 });
  });

  it.each([
    ["7", "2026-09-22"],
    ["90", "2026-07-01"],
  ])("range=%s starts on %s", (range, from) => {
    expect(resolveRange({ range }, today)).toMatchObject({ from, to: today });
  });

  it("accepts a valid custom range", () => {
    expect(resolveRange({ from: "2026-09-01", to: "2026-09-10" }, today)).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
      preset: null,
    });
  });

  it.each([
    [{ from: "2026-09-10", to: "2026-09-01" }],
    [{ from: "2026-02-30", to: "2026-03-05" }],
    [{ from: "nope", to: "2026-03-05" }],
    [{ from: "2024-01-01", to: "2026-09-01" }],
    [{ range: "1000" }],
  ])("falls back to the 30-day default for %j", (params) => {
    expect(resolveRange(params, today)).toMatchObject({ preset: 30, to: today });
  });
});

describe("derived metrics", () => {
  it("guards division by zero", () => {
    expect(conversionRate({ orders: 3, sessions: 0 })).toBe(0);
    expect(averageOrderValueCents({ orders: 0, revenue_cents: 0 })).toBe(0);
  });

  it("computes conversion and AOV", () => {
    expect(conversionRate({ orders: 2, sessions: 50 })).toBeCloseTo(0.04);
    expect(averageOrderValueCents({ orders: 3, revenue_cents: 10_000 })).toBe(3333);
  });
});
