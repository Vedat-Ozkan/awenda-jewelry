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

### GitHub repo: `vkozkan/awenda-jewelry`                                 (2026-09-15, owner)
**Decision:** Public repository at `github.com/vkozkan/awenda-jewelry`, default branch `main`.
**Why:** Owner confirmed the plan's proposed name; owner's existing GitHub account.
**Affects:** Phase 1 step 1 (create + push), step 7 (CI workflows, `CLOUDFLARE_*` repo secrets).

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
6. **Category list final?** Proposed: `necklace, bracelet, anklet, ring, earring`. Ask before Phase 2.
7. **Confirm inventory decrement timing** (Locked-proposed above). Ask before Phase 6.
8. **Email sender**: transactional email needs a verified domain in Resend, which needs the
   domain from #1. Until then use Resend's onboarding sender for tests only. Ask at Phase 9.
9. **Admin login emails** for `ADMIN_EMAILS` (Phase 4). Owner's address; parents' optional.
10. **Logo files** — where are they, and what formats? (Phase 5.) Need SVG or high-res PNG, plus a square icon for PWA manifest.
11. **Etsy shop / Pattern site** — the Pattern site is what the domain used to point at. Once the
   domain is disconnected, should the Etsy shop itself stay open (and be linked from the new
   footer) or be closed? Note: disconnecting the domain does not close the Etsy shop. (Phase 9.)
12. **Voyage model version** — `voyage-multimodal-3` (1024 dims) vs the newer `3.5`. Agent verifies
    current docs in Phase 3 step 2 and picks the newest stable; owner does not need to be asked
    unless dimension or pricing differs from this plan.
13. **Market details** — name, address, weekday, hours, pickup instructions (EN). Needed to seed
    `settings` in Phase 2; can be placeholders until Phase 9.
14. **Market-day oversell notice** — show a storefront banner during market hours saying
    "Orders placed during market hours are confirmed by email this evening"? Ask before Phase 5 step 8.
