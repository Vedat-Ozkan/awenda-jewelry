// Shared shapes for the client cart store and the /api/cart/quote route
// (Phase 5 step 6). CartLine is what actually lives in localStorage — the
// client never stores price or availability, only variantId + qty; the
// server (route.ts) re-derives everything else from public_designs on every
// quote request.
export interface CartLine {
  variantId: string;
  qty: number;
}

export type Fulfillment = "pickup" | "ship";

export interface QuoteRequest {
  lines: CartLine[];
  fulfillment: Fulfillment;
}

export interface QuoteLine {
  variantId: string;
  designSlug: string;
  name: string;
  variantLabel: string;
  unitPriceCents: number;
  qty: number;
  available: boolean;
  maxQty: number;
  thumb: string | null;
}

export interface QuoteResponse {
  lines: QuoteLine[];
  subtotalCents: number;
  shippingCents: number;
  // Flat rate regardless of the currently selected fulfillment — the cart
  // page needs this to label the Ship radio ("Ship (flat rate CAD X)") even
  // while Pickup is selected, when shippingCents itself is 0. Not in the
  // phase file's response field list, added because the label can't be
  // rendered without it (see 05-storefront.md step 6 / DECISIONS.md).
  shippingFlatCents: number | null;
  freeShippingThresholdCents: number | null;
  totalCents: number;
  shippingEnabled: boolean;
}
