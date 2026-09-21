# Awenda Jewelry

A bilingual (EN/FR) online store plus an AI-assisted inventory reconciliation PWA for a small
jewelry business that sells at a weekly market. Customers browse the catalog, pay with Stripe,
and choose to ship or pick up at the market; the owner catalogs stock, logs booth sales by
photo, and reconciles them against the online inventory using AI-proposed matches confirmed by
a human.

See `docs/plan/00-overview.md` for the full build plan.

## Prerequisites

- Node 22 (see `.nvmrc`)
- [pnpm](https://pnpm.io) (version pinned in `package.json`'s `packageManager` field)
- [Docker](https://docs.docker.com/get-docker/), for local Supabase

## Getting started

```
pnpm install
pnpm supabase start
cp .env.example .env.local   # fill in NEXT_PUBLIC_SITE_URL and CRON_SECRET
pnpm dev
```

For the Cloudflare Workers preview (`pnpm preview`), also copy the two required variables into
`.dev.vars` (wrangler's local secrets file) — same names as `.env.local`.

## Environment variables

Copy `.env.example` to `.env.local` for local development — see `docs/plan/00-overview.md` §6
for what each variable is for. `src/lib/env.ts` validates the server-side variables lazily, on
first access, and throws a readable error naming any required one that's missing.

In production (Cloudflare Workers), secret values are set with `wrangler secret put NAME`
(prompts for the value, never stored in the repo); non-secret values go in the `vars` block of
`wrangler.jsonc`.

## Admin login

`/admin` requires a Supabase magic-link sign-in from an address in `admin_emails` (seed it with
`pnpm seed:admins` after every `pnpm db:reset`). Locally, `pnpm supabase start` runs
[Mailpit](https://mailpit.axllent.org/) instead of sending real email — open
http://127.0.0.1:54324 after requesting a link and click the "Sign in" link in the newest
message addressed to you.

## Stripe (local)

Checkout (Phase 6) needs a Stripe test account. Set `STRIPE_SECRET_KEY` (test key,
`sk_test_...`) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_...`) in `.env.local` — get
them from the [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) in test mode.
`pnpm stripe:check` confirms the key works (prints the account id, country, and that
`livemode` is false).

For the webhook, run the [Stripe CLI](https://stripe.com/docs/stripe-cli) alongside `pnpm dev`:

```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It prints a `whsec_...` signing secret — set that as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

The full cart → Stripe → webhook → order path needs a real Stripe test key, so it isn't
covered by the automated e2e suite (which stubs `/api/checkout`'s response instead). Run it
manually once a key exists — see `docs/manual-tests.md`.

The orders admin's refund action also needs a real payment to refund against, so its e2e spec
sets `STRIPE_FAKE_REFUNDS=1` (dev/test only, ignored in production) to skip the Stripe call.

## Cron jobs

Two Cloudflare Cron Triggers (`wrangler.jsonc` `triggers.crons`) share the `scheduled()` handler
in `custom-worker.ts`, which branches on `event.cron` and pings the matching route with the
`x-cron-secret` header:

| Cron expression | Route | What it does |
|---|---|---|
| `0 6 */3 * *` | `/api/keepalive` | Pings Supabase every 3 days so the free-tier project doesn't idle-pause. |
| `0 14 * * *` | `/api/cron/pickup-reminders` | Emails the day-before-market reminder to `awaiting_pickup` orders due tomorrow. |

Both routes require `x-cron-secret: $CRON_SECRET` and can be triggered manually in dev:

```
curl -H "x-cron-secret: $CRON_SECRET" localhost:3000/api/keepalive
curl -H "x-cron-secret: $CRON_SECRET" localhost:3000/api/cron/pickup-reminders
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the Next.js dev server |
| `pnpm test` | Run Vitest unit + integration tests (integration tests need `pnpm supabase start` running) |
| `pnpm e2e` | Run Playwright e2e tests (starts its own dev server) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate Next.js + Cloudflare types, then `tsc --noEmit` |
| `pnpm db:reset` | Re-apply migrations to the local Supabase database |
| `pnpm db:types` | Regenerate `src/lib/supabase/database.types.ts` from the local database |
| `pnpm seed:admins` | Upsert `ADMIN_EMAILS` into `admin_emails` |

`pnpm db:reset` re-seeds from `supabase/seed.sql`, which does not include `admin_emails` — run
`pnpm seed:admins` again after every reset.

## Preview and deploy

- `pnpm preview` builds and serves the app locally under workerd (the actual Cloudflare
  runtime), via `@opennextjs/cloudflare`.
- `pnpm run deploy` builds and publishes to Cloudflare Workers. It must be invoked as
  `pnpm run deploy`, not `pnpm deploy` — the latter is pnpm's own built-in `deploy` command
  (for publishing workspace packages) and shadows the `deploy` script, failing with
  `ERR_PNPM_CANNOT_DEPLOY`.
- Deploying requires `wrangler login` once (interactive; owner only) and the `CRON_SECRET`
  Worker secret set with `wrangler secret put CRON_SECRET`.
- In CI, `.github/workflows/deploy.yml` runs `pnpm run deploy` after `ci.yml` succeeds on
  `main`, using the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the owner
  adds these in GitHub repo settings; agents cannot).

## Status

Work in progress — see `docs/plan/` for the phased implementation plan.
