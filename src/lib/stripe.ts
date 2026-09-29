import Stripe from "stripe";
import { env } from "@/lib/env";

// Lazy singleton, mirroring src/lib/env.ts's lazy-validation pattern:
// STRIPE_SECRET_KEY isn't required until a route actually creates a Stripe
// client, so `next build` (which imports every route module) never needs
// it — important right now since the owner is still creating the Stripe
// test account (DECISIONS.md "Payment processor stays Stripe").
//
// `httpClient: Stripe.createFetchHttpClient()` is required on Cloudflare
// Workers: the SDK's default Node http client uses `node:http`, which
// isn't available in the Workers runtime. `apiVersion: Stripe.API_VERSION`
// pins to the version this installed SDK ships types for, rather than
// leaving it unset (which would fall back to the account's
// Dashboard-configured default and could silently drift from the types).
let client: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (!client) {
    const apiKey = env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    client = new Stripe(apiKey, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: Stripe.API_VERSION,
    });
  }
  return client;
}
