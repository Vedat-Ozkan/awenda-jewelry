# Awenda Jewelry — Implementation Plan (Overview)

This directory is the step-by-step build plan for **Awenda Jewelry**: a bilingual (EN/FR)
online store plus an AI-assisted inventory reconciliation PWA for a small jewelry business
that sells at a weekly market. It is written for AI coding agents to execute phase by phase.

Read this file first, then `DECISIONS.md`, then the phase file you are assigned.
Also read the repository root `CLAUDE.md` — its rules (ask before assuming, simplicity,
surgical changes, verify every step) apply to every phase here.

---

## 1. What we are building

| Surface | Who uses it | What it does |
|---|---|---|
| **Storefront** (`/en`, `/fr`) | Customers | Browse catalog, add to cart, pay with Stripe, choose **Ship** or **Pick up at market**. Sold-out designs stay visible, greyed, with "similar styles". |
| **Admin: Catalog** (`/admin/catalog`) | Owner | Photograph new stock on a gray backdrop, enter name/category/price/variants, publish. Bulk ops (archive, restock, reprice). Photo generates a Voyage image embedding stored in pgvector. |
| **Admin: Analytics** (`/admin/analytics`) | Owner | Traffic (Cloudflare Web Analytics), funnel views → carts → orders, revenue, top and sold-out designs, leads (notify-me, newsletter). |
| **Admin: Orders** (`/admin/orders`) | Owner | View paid orders, mark shipped (with tracking) or picked up, refund. |

Business facts that shape the design:
- 200–500 unique designs, 2–3 units each (~600–1,500 pieces). Every category has variants
  (ring sizes, chain/bracelet/anklet lengths); earrings are "one size".
- One fixed weekly market (same place, same day). Pickup happens there.
- **Online stock is separate from market stock** (decided 2026-09-16). No booth logging or
  reconciliation at launch; those phases are deferred to `docs/plan/deferred/` until traffic
  justifies merging stock (then via SKU tags).
- The owner (a developer) operates all admin surfaces. The owner's parents own the business
  and only touch the public site.
- The business is in **Canada**: prices in **CAD**, shipping within Canada only at launch (US duties since the end of de minimis make small parcels uneconomic — see `DECISIONS.md`).
- Jewelry is light and small: **one flat shipping rate**, no live carrier rates.

---

## 2. Locked decisions (summary — full rationale in `DECISIONS.md`)

| Area | Decision |
|---|---|
| Sales model | Hybrid: pay online via Stripe Checkout (**CAD**); fulfillment = **Ship** (flat rate, Canada only) or **Pick up at market** (free). Shipping can be disabled by a settings toggle at launch. |
| Framework | TypeScript, Next.js (App Router), React, Tailwind. Package manager: `pnpm`. Node 22. |
| Hosting | **Cloudflare Workers** via `@opennextjs/cloudflare` (free tier; commercial use allowed). |
| Database | **Supabase Free** — Postgres + pgvector + Auth + Storage. A Cloudflare Cron Trigger pings it every 3 days to prevent idle-pausing. |
| Embeddings | **Voyage AI multimodal** (`voyage-multimodal-3.5`). Used for storefront "similar styles" only (booth photo matching deferred, 2026-09-16). Fake deterministic provider in tests. |
| Payments | Stripe Checkout (hosted). Webhook `checkout.session.completed` creates the order and decrements inventory. |
| Email | Resend (free tier) for order confirmations / shipping notices, EN + FR. |
| i18n | `next-intl`, locales `en` and `fr` (`en-CA`/`fr-CA` formatting), path prefix routing. UI chrome fully translated; product names/descriptions have optional FR with EN fallback. |
| Images | Resized **client-side** (canvas) to 1024px main + 400px thumb before upload. No server image processing (Sharp does not run on Workers; Supabase image transforms are Pro-only). |
| Variants | Every design has ≥1 variant row (`label`, `qty_on_hand`). "One size" is a variant. Size is never inferred from photos. |
| Stock model | Online stock separate from market stock; no reconciliation at launch. Deferred design: SKU tags (`R-047`). |
| Analytics | Cloudflare Web Analytics (cookieless) + first-party funnel events + `/admin/analytics`; leads via notify-me and newsletter. No GA4. |
| Testing | Vitest unit + integration (against local Supabase), Playwright e2e for cataloging, storefront, checkout, analytics. GitHub Actions CI on every PR. |
| Repo | Public GitHub repo, code only. Secrets in env, data only in Supabase. README doubles as a case study. |
| Brand | "Awenda Jewelry". Logo exists (owner will provide files). Domain `awendajewelry.com` already owned (registered via Etsy Pattern / Tucows) — recovery + DNS move in Phase 9. |
| Budget | $0/mo hosting + domain (~$10/yr) + Stripe per-transaction fees. |
| Design references | luzzojewellery.com (home), nazzar.ca (product page), mejuri.com/ca (bilingual Canadian DTC; variants, specs, trust row) — inspired, not copied. See `DECISIONS.md`. |

---

## 3. Architecture

```
                 ┌──────────────────────────────────────────────┐
                 │  Cloudflare Workers (OpenNext)               │
  Customer ───▶  │  Next.js App Router                          │
  Owner    ───▶  │   /[locale]/…        storefront (SSR/ISR)    │
                 │   /admin/…           PWA, Supabase Auth      │
                 │   /api/stripe/webhook                        │
                 │   /api/embed         → Voyage AI             │
                 │   cron: keepalive    → Supabase ping         │
                 └───────┬──────────────┬───────────┬───────────┘
                         │              │           │
                 ┌───────▼──────┐  ┌────▼────┐ ┌────▼─────┐
                 │ Supabase     │  │ Stripe  │ │ Resend   │
                 │ Postgres     │  │ Checkout│ │ email    │
                 │  + pgvector  │  │ Webhook │ └──────────┘
                 │ Auth (admin) │  │ Refunds │
                 │ Storage      │  └─────────┘
                 │  (photos)    │
                 └──────────────┘
```

Core inventory rule: **`variants.qty_on_hand` is the single source of truth**, changed only
through the Postgres function `adjust_inventory()` which also appends to the
`inventory_movements` ledger. Callers: catalog publish/restock, Stripe webhook (online sale),
refund. (Booth-sale callers arrive only if stock is merged later.)

---

## 4. Phases

Each phase is one branch and one PR. Do them in order; later phases assume earlier ones.

| # | File | Outcome | Depends on |
|---|---|---|---|
| 1 | `01-foundation.md` | Repo, tooling, CI, local Supabase, Cloudflare deploy of a hello page, keepalive cron | — |
| 2 | `02-data-model.md` | Full schema, RLS, `adjust_inventory()`, seed data, integration tests | 1 |
| 3 | `03-embeddings.md` | Image pipeline (client resize → Storage), Voyage provider + fake provider, `match_designs()` search | 2 |
| 4 | `04-admin-cataloging.md` | Admin auth, catalog CRUD, variant entry, bulk ops | 3 |
| 5 | `05-storefront.md` | Bilingual catalog + product pages, cart, sold-out behaviour, similar styles, SEO | 3 |
| 6 | `06-checkout-orders.md` | Stripe Checkout (ship/pickup), webhook → order + inventory, emails, orders admin | 4, 5 |
| 7 | `07-analytics.md` | Cloudflare Web Analytics, first-party funnel events, `/admin/analytics`, notify-me + newsletter leads | 5, 6 |
| — | `deferred/07-booth-logging.md`, `deferred/08-reconciliation.md` | **Deferred** until stock is merged (SKU tags) | — |
| 9 | `09-launch.md` | Domain, DNS, Stripe live mode, policies pages, backups, monitoring, README case study | 1–7 |

---

## 5. How agents must work on this project

0. **Use the delegation setup.** `CLAUDE.md` › "Workflow" defines the agents (`architect`,
   `implementer`, `reviewer`, `runner`) and the `/phase N` skill that runs a phase end to end.
   The main session orchestrates; implementers write code; the architect is consulted only for
   judgment calls; the runner executes noisy commands; the reviewer gates the PR.
1. **Read `CLAUDE.md` and `DECISIONS.md` before touching code.**
2. **Work one phase at a time** on a branch named `phase-N-short-name`. Open a PR; CI must be green.
3. **Every step has a verify check.** Run it. Do not mark a step done without the check passing.
4. **`STOP — ask the owner`** markers are hard stops. Post the question, do not guess, do not
   proceed past the marker until answered. Record the answer in `DECISIONS.md` (see its template).
5. **Do not add features** not in the phase file. If something seems missing, add it to
   `DECISIONS.md` under "Open" and ask.
6. **Never commit secrets.** `.env.local` is gitignored. Use `.env.example` for names only.
7. **Keep running costs at $0.** Do not enable paid tiers, paid add-ons, or new vendors without a
   `STOP` question.
8. **Tests are part of the step**, not a follow-up. A step that adds logic adds its test.
9. **Update this plan when reality differs.** If a library, API or limit differs from what is
   written here, fix the plan file in the same PR and note it in `DECISIONS.md`.
10. **Bilingual by default.** Any user-facing string goes through `next-intl` messages
    (`messages/en.json`, `messages/fr.json`). Admin UI is English only.

---

## 6. Environment variables (master list)

| Name | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | RLS enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (webhook, cron, embeddings) | never shipped to client |
| `ADMIN_EMAILS` | server | comma-separated allowlist for admin login |
| `VOYAGE_API_KEY` | server | |
| `EMBEDDINGS_PROVIDER` | server | `voyage` \| `fake` (tests/CI) |
| `STRIPE_SECRET_KEY` | server | test key locally, live key in prod |
| `STRIPE_WEBHOOK_SECRET` | server | from Stripe dashboard / `stripe listen` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | |
| `RESEND_API_KEY` | server | |
| `EMAIL_FROM` | server | e.g. `Awenda Jewelry <orders@…>` (needs verified domain — Phase 9) |
| `NEXT_PUBLIC_SITE_URL` | both | `http://localhost:3000` locally |
| `CRON_SECRET` | server | protects the keepalive endpoint |
| `NEXT_PUBLIC_CF_BEACON_TOKEN` | client | Cloudflare Web Analytics site token (Phase 7) |

---

## 7. Glossary

- **Design** — a unique jewelry item as listed (one photo, one price). Has 1+ variants.
- **Variant** — a size/length option of a design with its own `qty_on_hand`. "One size" is a variant.
- **Booth sale / Reconciliation / Oversell / SKU** — deferred concepts (see `deferred/`); not part of the launch scope.
- **Lead** — an email captured via "notify me when back in stock" (per design) or the newsletter signup.
- **Movement** — one row in `inventory_movements`; the audit ledger of every quantity change.
