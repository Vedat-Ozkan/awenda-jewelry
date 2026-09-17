import { describe, expect, it } from "vitest";
import { sortForCatalog } from "./sort";

function design(id: string, status: "active" | "archived", total_qty: number) {
  return { id, status, total_qty };
}

describe("sortForCatalog", () => {
  it("moves sold-out (total_qty = 0) designs after in-stock ones, preserving order within each group", () => {
    const designs = [design("a", "active", 0), design("b", "active", 5), design("c", "active", 2)];
    expect(sortForCatalog(designs).map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("treats archived designs as sold out even when total_qty > 0", () => {
    const designs = [design("a", "archived", 4), design("b", "active", 5)];
    expect(sortForCatalog(designs).map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortForCatalog([])).toEqual([]);
  });
});
