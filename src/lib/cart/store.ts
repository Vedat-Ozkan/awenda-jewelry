import { cartReducer, type CartAction, type CartState } from "./reducer";

const STORAGE_KEY = "awenda-cart";

type Listener = () => void;

// Plain external store (not React state) backing CartContext.tsx via
// useSyncExternalStore. Needed because localStorage is a synchronous
// browser API with no server-side equivalent: reading it can only happen on
// the client, but doing so by calling setState from a mount effect trips
// eslint-plugin-react-hooks' `set-state-in-effect` rule (and is exactly the
// case useSyncExternalStore exists for — see the React docs on subscribing
// to external stores with SSR). getServerSnapshot() below is what the
// server (and the client's hydration-matching first render) sees; React
// then reconciles to getSnapshot()'s real localStorage-backed value right
// after hydration, with no manual "hydrated" flag needed.
let state: CartState = [];
let initialized = false;
const listeners = new Set<Listener>();

function readFromStorage(): CartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartState) : [];
  } catch {
    return []; // malformed JSON or storage blocked (private mode)
  }
}

function writeToStorage(next: CartState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage blocked/full — cart still works for this page load
  }
}

function ensureInitialized() {
  if (initialized) return;
  state = readFromStorage();
  initialized = true;
}

export function dispatch(action: CartAction) {
  ensureInitialized();
  state = cartReducer(state, action);
  writeToStorage(state);
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Stable reference across calls when nothing changed — required by
// useSyncExternalStore to avoid re-render loops.
export function getSnapshot(): CartState {
  ensureInitialized();
  return state;
}

// Must be a stable reference: React warns (and can loop) if getServerSnapshot
// returns a fresh array on every call.
const EMPTY: CartState = [];

export function getServerSnapshot(): CartState {
  return EMPTY;
}
