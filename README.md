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
