# Awenda Jewelry

A bilingual (EN/FR) online store plus an AI-assisted inventory reconciliation PWA for a small
jewelry business that sells at a weekly market. Customers browse the catalog, pay with Stripe,
and choose to ship or pick up at the market; the owner catalogs stock, logs booth sales by
photo, and reconciles them against the online inventory using AI-proposed matches confirmed by
a human.

See `docs/plan/00-overview.md` for the full build plan.

## Environment variables

Copy `.env.example` to `.env.local` for local development — see `docs/plan/00-overview.md` §6
for what each variable is for. `src/lib/env.ts` validates the server-side variables at import
and throws a readable error naming any required one that's missing.

In production (Cloudflare Workers), secret values are set with `wrangler secret put NAME`
(prompts for the value, never stored in the repo); non-secret values go in the `vars` block of
`wrangler.jsonc`.

## Status

Work in progress — see `docs/plan/` for the phased implementation plan.
