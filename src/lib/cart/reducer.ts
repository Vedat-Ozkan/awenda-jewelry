import type { CartLine } from "./types";

// Pure cart reducer (Phase 5 step 6) — no I/O, so it's unit-testable on its
// own (reducer.test.ts). CartContext.tsx wraps this in useReducer, hydrates
// it from localStorage after mount, and persists every change back.
export type CartState = CartLine[];

export type CartAction =
  | { type: "hydrate"; lines: CartState }
  | { type: "add"; variantId: string; qty: number; maxQty: number }
  | { type: "setQty"; variantId: string; qty: number; maxQty: number }
  | { type: "remove"; variantId: string }
  | { type: "clear" };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return action.lines;

    case "add": {
      const maxQty = Math.max(action.maxQty, 0);
      const existing = state.find((line) => line.variantId === action.variantId);
      if (existing) {
        const qty = Math.min(existing.qty + action.qty, maxQty);
        return state.map((line) => (line.variantId === action.variantId ? { ...line, qty } : line));
      }
      const qty = Math.min(Math.max(1, action.qty), maxQty);
      if (qty <= 0) return state;
      return [...state, { variantId: action.variantId, qty }];
    }

    case "setQty": {
      const qty = Math.min(Math.max(1, action.qty), Math.max(action.maxQty, 1));
      return state.map((line) => (line.variantId === action.variantId ? { ...line, qty } : line));
    }

    case "remove":
      return state.filter((line) => line.variantId !== action.variantId);

    case "clear":
      return [];

    default:
      return state;
  }
}
