# Decision Log

Two sections: **Locked** (decided with the owner — do not re-litigate without a `STOP` question)
and **Open** (must be asked before the referenced step). When you resolve an Open item, move it
to Locked with the date and the owner's answer.

Template for a new entry:

```
### <short title>            (YYYY-MM-DD, decided by: owner | agent-with-owner-approval)
**Decision:** …
**Why:** …
**Affects:** phase/step refs
```

---

## Locked

### Sales model: hybrid pay-online, ship or pick up            (2026-09-15, owner)
**Decision:** Full Stripe Checkout from day one. At checkout the customer picks **Ship** (one
flat rate, US only initially) or **Pick up at market** (free). Shipping can be turned off via
`settings.shipping_enabled` so the store can launch pickup-only.
**Why:** The earlier reserve-for-pickup model (unpaid holds) was judged "weird" by the owner;
payment secures the item and removes hold-expiry logic. Technical cost is low because Stripe's
hosted page handles cart/cards/receipts and jewelry ships flat-rate in a padded mailer.
**Affects:** Phase 6.

### Operators: owner runs all admin; parents get the public site only   (2026-09-15, owner)
**Decision:** Admin UI may assume a technical, English-speaking user. Parents' involvement is
the storefront brand and handing over pickups at the market.
**Affects:** Phases 4, 7, 8 (no i18n in admin; still mobile-first because booth mode is used on a phone).

### Hosting: Cloudflare Workers + Supabase Free + keepalive            (2026-09-15, owner)
**Decision:** $0/mo. Next.js deployed with `@opennextjs/cloudflare`. Supabase Free tier for
Postgres/pgvector/Auth/Storage, with a Cloudflare Cron Trigger every 3 days hitting a keepalive
route to avoid the 7-day-idle pause.
**Why:** Vercel Hobby's ToS forbids commercial use; Cloudflare's free tier does not. Owner asked
for the lowest reasonable operating cost. Upgrade path: Supabase Pro ($25/mo) if storage (1 GB)
or DB (500 MB) limits are hit, or if backups become critical.
**Affects:** Phase 1 (deploy), Phase 3 (no Sharp on Workers → client-side resize), Phase 9 (backups by cron dump).

### Embeddings: Voyage AI multimodal                                    (2026-09-15, owner)
**Decision:** Use Voyage's multimodal embedding API for catalog photos (input_type `document`)
and booth photos (input_type `query`). Store in pgvector, cosine distance, HNSW index.
**Why:** Hosted, no cold starts, priced per pixel: $0.60 per billion pixels, max $0.0012/image
(2 MP cap), 150 B free pixels ≈ 75 k images. Our volume (~6 k images/yr) is $0 for years.
**Affects:** Phase 3. Provider is behind an interface so it can be swapped.

### Variants on every category                                          (2026-09-15, owner)
**Decision:** Rings (sizes), necklaces (chain lengths), bracelets and anklets (lengths),
earrings (one size). Every design has ≥1 variant row. Variant presets per category live in
`settings.variant_presets` and are used by both cataloging and booth logging.
**Why:** Vision models cannot read a size from a photo; size is metadata captured by tap.
**Affects:** Phase 2 schema, Phase 4 entry UI, Phase 7 booth picker.

### Locale: English + French, USD                                       (2026-09-15, owner)
**Decision:** `next-intl` with `/en` and `/fr` prefixes. All storefront chrome, emails, and
policy pages translated. Product `name_fr` / `description_fr` optional, fall back to EN.
**Affects:** Phases 5, 6, 9.

### Market: one fixed weekly market                                     (2026-09-15, owner)
**Decision:** Market name, address, weekday and hours are stored once in `settings`. A
`market_closed_until` date plus a short note handles skipped weeks. Storefront shows
"Next pickup: <computed next market date>".
**Affects:** Phase 2 settings, Phase 5, Phase 6 pickup emails.

### Testing: unit + integration + Playwright e2e, CI on PRs             (2026-09-15, owner)
**Decision:** Vitest for pure logic; integration tests run against local Supabase (Docker);
Playwright covers cataloging, booth logging, reconciliation, and checkout up to the Stripe
redirect plus a simulated signed webhook. `EMBEDDINGS_PROVIDER=fake` in tests.
**Affects:** All phases.

### Repo: public, code only                                             (2026-09-15, owner)
**Decision:** Public GitHub repository. No product data, photos, or customer data in git.
README is written as a case study (Phase 9) for resume use: "AI-assisted inventory
reconciliation PWA + bilingual e-commerce".

### Brand: "Awenda Jewelry", logo exists                                 (2026-09-15, owner)
**Decision:** Placeholder wordmark until the owner drops logo files into `public/brand/`.

### Domain: `awendajewelry.com`, already owned via Etsy Pattern          (2026-09-15, owner)
**Decision:** Do not buy a domain. The family already owns `www.awendajewelry.com`, registered
through Etsy Pattern (registrar: Tucows/OpenSRS, managed via Hover). Phase 9 step 1 recovers
control (disconnect from Pattern, access at Hover), points nameservers at Cloudflare, and
optionally transfers the registration to Cloudflare Registrar afterwards.
**Why:** Keeps the brand's existing URL and any inbound links; Etsy states Pattern domains are
owned by the seller, not Etsy. RDAP on 2026-09-15: registrar Tucows Domains Inc., registered
2022-10-11, **expires 2027-10-11**, last changed 2026-09-12, status `client transfer prohibited`
(normal registrar lock — must be unlocked at Hover before any transfer). Nameservers are NS1
(`dns1–4.p01.nsone.net`, Etsy's DNS) with no A record, i.e. registered but serving nothing.
**Affects:** Phase 9 steps 1–2, Open #1 (resolved), Open #11.

### Inventory decrement timing for online orders                        (2026-09-15, agent-with-owner-approval pending)
**Decision (proposed, see Open #7):** Decrement on `checkout.session.completed`, not at
cart or session creation. If stock is insufficient at that moment, auto-refund and email the
customer. No soft-hold table.
**Why:** Simplest correct behaviour; two customers buying the same last unit within one
30-minute Checkout window is rare at 2–3 units/design and low prices, and the refund path is
needed anyway for booth oversells.

### Images resized client-side; two sizes stored                        (2026-09-15, agent)
**Decision:** Browser canvas produces `main` (≤1024 px long edge, JPEG q≈0.85) and `thumb`
(≤400 px). Both uploaded to Supabase Storage. Voyage receives `main`.
**Why:** Sharp is unavailable on Cloudflare Workers; Supabase image transforms require Pro.
Keeps storage well under the 1 GB free limit (~500 designs × ~250 KB ≈ 125 MB).

### GitHub repo: `Vedat-Ozkan/awenda-jewelry`                             (2026-09-15, owner)
**Decision:** Public repository at `github.com/Vedat-Ozkan/awenda-jewelry`, default branch `main`.
**Why:** Owner confirmed the plan's proposed name. Originally recorded as `vkozkan/…` (the git
author name); corrected at Phase 1 close to the owner's actual GitHub account (`gh auth` login).
**Affects:** Phase 1 step 1 (create + push), step 7 (CI workflows, `CLOUDFLARE_*` repo secrets).

### Phase 1 plan drift                                                  (2026-09-15, agent)
**Decision:** Corrections applied to `01-foundation.md` in the Phase 1 PR:
- `pnpm deploy` is shadowed by pnpm's built-in `deploy`; the script keeps its name and is run as
  `pnpm run deploy` (README, `deploy.yml`).
- `next build` typechecks `custom-worker.ts`, which needs the gitignored `cloudflare-env.d.ts`, so
  the `build` script runs `wrangler types` first; CI also runs `pnpm build` so build-only failures
  surface on PRs.
- `src/lib/env.ts` validates lazily on first access, not at import — `next build` imports every
  route module and must not require secrets.
- `supabase status -o env` emits `API_URL`/`ANON_KEY`, not `SUPABASE_URL`.
- Lighthouse ≥ 12 has no PWA audit; step 8 is verified via DevTools → Application → Manifest.
- Production worker: `https://awenda-jewelry.awenda.workers.dev` (workers.dev subdomain `awenda`,
  temporary until Phase 9).
**Affects:** Phase 1 steps 3, 5, 6, 7, 8; Phase 9 (domain cutover replaces the workers.dev URL).

### Categories and default variant presets                             (2026-09-16, owner)
**Decision:** `category` enum = `necklace, bracelet, anklet, ring, earring, bangle, chain, pendant`.
Default `settings.variant_presets` (loose; edited in settings, never in code):
`ring` 5–10 · `necklace`, `chain` 16"/18"/20"/24" · `bracelet` 6.5"/7"/7.5"/8" · `anklet` 9"/10" ·
`bangle` Small/Medium/Large · `earring`, `pendant` One size.
**Why:** Owner's stock spans more product types than the proposed five. Presets are only
quick-tap defaults — the variant `label` is free text, so any sizing can be entered; the owner
did not want to finalise sizes now. Adding an enum value later is a migration; removing is hard.
**Affects:** Phase 2 schema/seed, Phase 4 entry UI, Phase 7 booth picker. Resolves Open #6.

### Market details: placeholders until Phase 9                          (2026-09-16, owner)
**Decision:** Seed `settings` with `market_name='Weekly Market'`, `market_address='TBD'`,
Saturday (`market_weekday=6`) 09:00–14:00, pickup instructions 'TBD' (EN/FR). Real details
are collected at Phase 9 step 1.
**Affects:** Phase 2 step 2. Open #13 stays open for the real values.

### Phase 2 plan drift and review findings                               (2026-09-16, agent)
**Decision:**
- `settings.market_timezone` (IANA, default `America/New_York`) added; `next_market_date()`
  compares in that zone (Supabase server time is UTC) and returns `null` when unconfigured
  instead of looping. Owner confirms the real timezone with the market details at Phase 9.
- `adjust_inventory()` and `match_designs()` have EXECUTE revoked from `public`/`anon`/
  `authenticated` (Supabase grants it by default); only `service_role` calls them until Phase 3/4
  decide otherwise. `next_market_date()` stays public for the storefront.
- Views `public_designs`/`public_settings`: `revoke all` then `grant select` — a simple view is
  auto-updatable and would otherwise let anon write `settings` through it.
- `design_images` public policy uses a `security definer` helper `design_is_published()`.
- `match_designs()` is not yet `security definer`; Phase 3 must add it (or a policy) before the
  storefront calls it.
- Seed image paths (`seed/<slug>.svg`) are served from `public/seed/`, not Storage; Phase 3 replaces.
- CI pins `supabase/setup-cli` to the `supabase` devDependency version.
**Affects:** Phase 2 migrations/tests; Phase 3 step 5 (`match_designs` grants); Phase 9 (timezone).

### Hosted Supabase project created at Phase 3                          (2026-09-16, owner)
**Decision:** Create the free hosted Supabase project now rather than at Phase 9. Owner creates
it in the dashboard and runs `supabase login`; the agent links the repo (`supabase link`) and
pushes migrations (`supabase db push`). Worker config: `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `wrangler.jsonc` `vars`, `SUPABASE_SERVICE_ROLE_KEY` via
`wrangler secret put`. Seed data is NOT pushed to the hosted project (real catalog only).
**Why:** Fixes the production keepalive (500 since Phase 2), and lets Storage uploads (Phase 3)
and admin login (Phase 4) be exercised against the real project. Still $0.
**Affects:** Phase 3 (Storage bucket exists via migration), Phase 4, Phase 9 (backups). Resolves Open #15.

### Voyage model: `voyage-multimodal-3.5`, 1024 dims                    (2026-09-16, agent)
**Decision:** Use `voyage-multimodal-3.5` (newest stable, supersedes `voyage-multimodal-3`).
Output dimension is configurable (256/512/1024/2048) with **1024 as the default**, so the
`vector(1024)` columns stand. Endpoint `POST /v1/multimodalembeddings`, image sent as a
base64 data URL, `input_type` `document` (catalog) / `query` (booth).
**Why:** Verified against docs.voyageai.com on 2026-09-16. Pricing unchanged from the plan:
$0.60 per billion pixels, $0.0012/image cap, 150 B free pixels.
**Affects:** Phase 3 step 2. Resolves Open #12 without asking the owner (per its own terms).

### Phase 3 plan drift                                                  (2026-09-16, agent)
**Decision:**
- `match_designs()` stays `service_role`-only (not `security definer`); all vector search goes
  through the server-side `findCandidates()` behind `requireAdmin`. Phase 5 "similar styles"
  must call it server-side with the service client too — do not grant it to `anon`.
- Scripts run via `tsx --env-file=.env.local` (re-added as a devDependency); Node's bare
  `--experimental-strip-types` can't resolve `@/` aliases. tsx emits CJS, so scripts use an
  async `main()` instead of top-level await.
- `requireAdmin(request)` accepts `Authorization: Bearer <jwt>` (validated server-side via
  `auth.getUser`) or the cookie session; `requireAdminFromCookies()` for server actions.
  Membership = lower-cased email present in `admin_emails`.
- The dev harness `/admin/dev/embed` has a dev-only password sign-in (no login UI until
  Phase 4) and is prerendered as a 404 in production builds; its server actions also refuse
  to run in production.
- Test fixtures are ~324 KB / ~56 KB (jpeg-js baseline floor), not the ~200 KB the phase file
  suggested. `.gitattributes` marks `*.jpg` binary.
- `/api/photos` rejects bodies over 5 MB via `content-length` (413) before parsing.
- Production Worker: `EMBEDDINGS_PROVIDER=voyage` in `wrangler.jsonc` vars; `VOYAGE_API_KEY`
  and `SUPABASE_SERVICE_ROLE_KEY` are Worker secrets.
- Voyage baseline distance for a real item photographed twice: **pending owner's manual check**
  (record here when done).
**Affects:** Phase 3; Phase 4 (login reuses `requireAdmin`); Phase 5 (similar styles via server).

---

## Open — ask the owner before the referenced step

1. ~~Exact domain to buy~~ **Resolved:** `awendajewelry.com` already owned (see Locked). Still
   needed from the owner before Phase 9 step 1: (a) who has login to the Etsy account that
   holds the Pattern shop, (b) the domain's expiry date and whether auto-renew is on at
   Hover/Tucows, (c) keep registration at Hover or transfer to Cloudflare Registrar.
2. **Stripe Tax on or off, and business home state** (Phase 6). Stripe Tax adds 0.5%/txn and
   only calculates — it does not file. Small sellers often collect only in their home state.
   Owner/parents should confirm with their accountant; plan defaults to **off** with a
   `settings.stripe_tax_enabled` flag.
3. **Flat shipping rate and free-shipping threshold** (Phase 6). Proposed default: $5.00 flat,
   free over $50. US-only shipping initially — confirm.
4. **Return / exchange policy text** (Phase 9). Needs owner-written EN text; agent translates to FR for review.
5. **French product names**: (a) owner types both, (b) FR optional with EN fallback (current
   default), or (c) auto-translate at catalog time with an LLM (adds a vendor). Ask before Phase 4 step 6.
6. ~~Category list final?~~ **Resolved 2026-09-16** — see Locked "Categories and default variant presets".
7. **Confirm inventory decrement timing** (Locked-proposed above). Ask before Phase 6.
8. **Email sender**: transactional email needs a verified domain in Resend, which needs the
   domain from #1. Until then use Resend's onboarding sender for tests only. Ask at Phase 9.
9. **Admin login emails** for `ADMIN_EMAILS` (Phase 4). Owner's address; parents' optional.
10. **Logo files** — where are they, and what formats? (Phase 5.) Need SVG or high-res PNG, plus a square icon for PWA manifest.
11. **Etsy shop / Pattern site** — the Pattern site is what the domain used to point at. Once the
   domain is disconnected, should the Etsy shop itself stay open (and be linked from the new
   footer) or be closed? Note: disconnecting the domain does not close the Etsy shop. (Phase 9.)
12. ~~Voyage model version~~ **Resolved 2026-09-16** — `voyage-multimodal-3.5`, 1024 dims (see Locked).
13. **Market details** — name, address, weekday, hours, pickup instructions (EN). Seeded as
    placeholders in Phase 2 (owner, 2026-09-16); real values needed at Phase 9 step 1.
14. **Market-day oversell notice** — show a storefront banner during market hours saying
    "Orders placed during market hours are confirmed by email this evening"? Ask before Phase 5 step 8.
15. ~~When to create the hosted Supabase project~~ **Resolved 2026-09-16** — created at Phase 3 (see Locked).
