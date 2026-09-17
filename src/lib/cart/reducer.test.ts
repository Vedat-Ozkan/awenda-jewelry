import { describe, expect, it } from "vitest";
import { cartReducer, type CartState } from "./reducer";

describe("cartReducer", () => {
  it("adds a new line capped at maxQty", () => {
    const state = cartReducer([], { type: "add", variantId: "v1", qty: 10, maxQty: 3 });
    expect(state).toEqual<CartState>([{ variantId: "v1", qty: 3 }]);
  });

  it("merges into an existing line, summing and capping at maxQty", () => {
    const initial: CartState = [{ variantId: "v1", qty: 2 }];
    const state = cartReducer(initial, { type: "add", variantId: "v1", qty: 3, maxQty: 4 });
    expect(state).toEqual<CartState>([{ variantId: "v1", qty: 4 }]);
  });

  it("does not add a line when maxQty is 0", () => {
    const state = cartReducer([], { type: "add", variantId: "v1", qty: 1, maxQty: 0 });
    expect(state).toEqual<CartState>([]);
  });

  it("setQty clamps between 1 and maxQty", () => {
    const initial: CartState = [{ variantId: "v1", qty: 1 }];
    expect(cartReducer(initial, { type: "setQty", variantId: "v1", qty: 99, maxQty: 5 })).toEqual<CartState>([
      { variantId: "v1", qty: 5 },
    ]);
    expect(cartReducer(initial, { type: "setQty", variantId: "v1", qty: 0, maxQty: 5 })).toEqual<CartState>([
      { variantId: "v1", qty: 1 },
    ]);
  });

  it("removes a line by variantId", () => {
    const initial: CartState = [
      { variantId: "v1", qty: 1 },
      { variantId: "v2", qty: 2 },
    ];
    expect(cartReducer(initial, { type: "remove", variantId: "v1" })).toEqual<CartState>([{ variantId: "v2", qty: 2 }]);
  });

  it("clear empties the cart", () => {
    const initial: CartState = [{ variantId: "v1", qty: 1 }];
    expect(cartReducer(initial, { type: "clear" })).toEqual<CartState>([]);
  });

  it("produces the exact { variantId, qty }[] persisted shape, no extra fields", () => {
    const state = cartReducer([], { type: "add", variantId: "v1", qty: 2, maxQty: 5 });
    expect(JSON.parse(JSON.stringify(state))).toEqual([{ variantId: "v1", qty: 2 }]);
    expect(Object.keys(state[0]).sort()).toEqual(["qty", "variantId"]);
  });
});
