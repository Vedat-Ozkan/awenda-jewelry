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

## Analytics and leads

No cookies and no consent banner; the numbers come from two places (DECISIONS.md "Analytics
and lead capture").

- **Traffic** (visitors, referrers, countries, top pages, Web Vitals): Cloudflare Web
  Analytics. The beacon is rendered by the storefront layout only (never `/admin`), and only
  when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set (it is in `wrangler.jsonc`; `pnpm run deploy`
  exports it for the build). The Web Analytics site is `awenda-jewelry.awenda.workers.dev`;
  add `awendajewelry.com` to it at the Phase 9 cutover.
- **Funnel** (sessions, design views, add-to-carts, checkouts started): first-party events sent
  by `src/lib/analytics/client.ts` to `POST /api/track` and stored in `analytics_events`. The
  only identifier is a random per-tab session id in `sessionStorage`; no IP, cookie or email is
  stored. Events older than 13 months are deleted by the keepalive cron.
- **Orders, revenue, AOV, ship vs pickup** come from the `orders` table.
- **Leads**: "Notify me when it's back" (`stock_notifications`) and the footer newsletter
  (`newsletter_subscribers`); every email carries an unsubscribe link
  (`/api/leads/unsubscribe`).

`/admin/analytics` shows all of it for a 7 / 30 / 90-day or custom range (dates are read in the
market timezone from `/admin/settings`): tiles, sessions and orders by day, revenue by week,
top viewed designs, **most viewed sold-out designs** (demand you're missing), referrers, locale
and device split, and the two lead lists with **Export CSV**
(`/api/admin/stock-notifications.csv`, `/api/admin/newsletter.csv`). The aggregates come from
one SQL function, `analytics_summary(from, to)` (`supabase/migrations/0013_analytics_functions.sql`),
which runs as the signed-in admin so the `is_admin()` RLS policies apply. The privacy wording
is on `/en/policies` and `/fr/policies`.

## Cron jobs

Two Cloudflare Cron Triggers (`wrangler.jsonc` `triggers.crons`) share the `scheduled()` handler
in `custom-worker.ts`, which branches on `event.cron` and pings the matching route with the
`x-cron-secret` header:

| Cron expression | Route | What it does |
|---|---|---|
| `0 6 * * *` | `/api/keepalive` | Pings Supabase daily so the free-tier project doesn't idle-pause (backed up by the GitHub `keepalive.yml` workflow, which emails on failure). |
| `0 14 * * *` | `/api/cron/pickup-reminders` | Emails the day-before-market reminder to `awaiting_pickup` orders due tomorrow. |

Both routes require `x-cron-secret: $CRON_SECRET` and can be triggered manually in dev:

```
curl -H "x-cron-secret: $CRON_SECRET" localhost:3000/api/keepalive
curl -H "x-cron-secret: $CRON_SECRET" localhost:3000/api/cron/pickup-reminders
```

## AI product photos (owner setup)

A manual batch, run a few times a week in Claude Code with `/ai-photos` (add `prod` for the
live shop, e.g. `/ai-photos prod 5`). For every design with real photos and no AI photos yet,
Codex CLI generates a studio shot (becomes the main image) and a model shot; Claude checks them
against the real photos, you approve in the session, and the approved ones are uploaded. The
original photos are kept in the gallery after the two new ones. Plan: `docs/plan/10-ai-photos.md`.

One-time setup:

1. Codex CLI installed and logged in with ChatGPT: `codex login status`.
2. For production runs, create `.env.production.local` (git-ignored) with
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VOYAGE_API_KEY` and
   `EMBEDDINGS_PROVIDER=voyage`. Local runs use `.env.local`.

Scripts (`ai-photos/batches/` is git-ignored): `pnpm ai-photos:fetch [--limit N]` and
`pnpm ai-photos:upload [<batch dir>]`, each with a `:prod` variant.

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
| `pnpm ai-photos:fetch` / `:upload` | AI product photo batch (see above; `:prod` variants target production) |

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
- After `supabase db push` applies migration 0014, every existing hosted design is
  `stainless_steel`. The owner must reclassify sterling-silver designs in /admin (edit page,
  metal select).

## Status

Work in progress — see `docs/plan/` for the phased implementation plan.
