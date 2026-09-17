import { NextResponse } from "next/server";

// Stub for Phase 6 (Stripe Checkout — DECISIONS.md "Sales model"). Exists
// now so the cart page's Checkout button has a real endpoint to post to;
// Phase 6 replaces this with the real Stripe Checkout session creation.
export async function POST() {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
