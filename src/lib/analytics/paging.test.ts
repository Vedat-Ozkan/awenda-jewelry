import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./paging";

function source(total: number) {
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => from + i);
  };
  return { calls, fetchPage };
}

describe("fetchAllPages", () => {
  it("stops after a short page", async () => {
    const { calls, fetchPage } = source(25);
    const rows = await fetchAllPages(fetchPage, 10);
    expect(rows).toHaveLength(25);
    expect(calls).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
  });

  it("reads one extra (empty) page when the total is an exact multiple", async () => {
    const { calls, fetchPage } = source(20);
    const rows = await fetchAllPages(fetchPage, 10);
    expect(rows).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(calls).toHaveLength(3);
  });

  it("returns [] for an empty source with a single call", async () => {
    const { calls, fetchPage } = source(0);
    expect(await fetchAllPages(fetchPage, 10)).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});
