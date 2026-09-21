// Standalone check: retrieves the Stripe account for STRIPE_SECRET_KEY and
// prints its id, country, and whether it's in test mode.
//
// Usage:
//   pnpm stripe:check
// (or directly: pnpm tsx --env-file=.env.local scripts/stripe-check.ts)
//
// Run via `tsx` (not plain `node`) so the `@/*` path alias and tsconfig
// `paths` resolve the same way they do in the Next.js app.
import { getStripeClient } from "@/lib/stripe";

// Wrapped in an async function, not top-level await: tsx transpiles this
// file to CJS (no "type": "module" in package.json), which disallows
// top-level await.
async function main() {
  const stripe = getStripeClient();
  // Account objects have no `livemode` field (only per-object resources
  // like Balance do) — retrieve(null) gets the account tied to the API key
  // (per the SDK's own doc comment), balance.retrieve() gets `livemode`.
  const [account, balance] = await Promise.all([stripe.accounts.retrieve(null), stripe.balance.retrieve()]);
  console.log(`account.id=${account.id} country=${account.country} livemode=${balance.livemode}`);
}

main();
