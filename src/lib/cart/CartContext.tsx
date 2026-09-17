"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { CartState } from "./reducer";
import * as cartStore from "./store";

interface CartContextValue {
  lines: CartState;
  add: (variantId: string, qty: number, maxQty: number) => void;
  setQty: (variantId: string, qty: number, maxQty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

// Client cart store (Phase 5 step 6): a small context wrapping the plain
// external store in ./store.ts (useReducer + a manual "hydrated" boolean
// was the first pass here, but reading localStorage from a mount effect
// trips eslint-plugin-react-hooks' set-state-in-effect rule —
// useSyncExternalStore is the React-endorsed way to sync render state with
// an external, synchronous, browser-only source like localStorage across
// SSR/hydration).
export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);

  const value: CartContextValue = {
    lines,
    add: (variantId, qty, maxQty) => cartStore.dispatch({ type: "add", variantId, qty, maxQty }),
    setQty: (variantId, qty, maxQty) => cartStore.dispatch({ type: "setQty", variantId, qty, maxQty }),
    remove: (variantId) => cartStore.dispatch({ type: "remove", variantId }),
    clear: () => cartStore.dispatch({ type: "clear" }),
    count: lines.reduce((sum, line) => sum + line.qty, 0),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
