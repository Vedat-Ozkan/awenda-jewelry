# Phase 9 — Launch and Handoff

**Goal:** Real domain, live payments, policies, backups, monitoring, and a README written as a
case study. After this phase the site is the family business's online presence and the repo is
resume-ready.

**Branch:** `phase-9-launch` (several small PRs are fine)
**Depends on:** Phases 1–8.
**Definition of done:** `https://<domain>` serves the storefront with a valid certificate;
a real $1 test purchase in live mode succeeds and is refunded; weekly backup workflow has run
once successfully; README case study reviewed by the owner.

> **STOP — ask the owner** at: step 1 (domain), step 3 (policies text, about text, logo final),
> step 4 (Stripe live keys — owner enters them), step 8 (Etsy).

---

## Steps

### 1. Domain — recover `awendajewelry.com` from Etsy Pattern
The domain is already owned; it was bought through Etsy Pattern, which registers domains via
Tucows/OpenSRS and exposes management through Hover. **All sub-steps below are owner actions
(they need the Etsy and Hover logins); the agent prepares Cloudflare and verifies.**

1a. **Check expiry first.** Known as of 2026-09-15: expires **2027-10-11** (registrar Tucows).
    Re-check with `curl -sL https://rdap.verisign.com/com/v1/domain/awendajewelry.com` and
    confirm at Hover that auto-renew is on. If it expires within 45 days, renew before anything else.
1b. **Disconnect from Pattern.** Etsy Shop Manager → Sales Channels → Pattern shop → **Domains**
    tab → **Manage** next to the domain → **Disconnect**. This does not close the Etsy shop.
1c. **Gain DNS control at Hover.** If the owner has no Hover login, use Hover's "claim domain /
    forgot password" with the email used on Etsy, or contact Hover support citing the Pattern
    purchase. Goal: the domain appears in a Hover account the family controls.
1d. **Add the site to Cloudflare** (agent): Cloudflare dashboard → Add site → `awendajewelry.com`
    (Free plan) → note the two assigned nameservers. Add the Worker custom domain in
    `wrangler.jsonc` (`routes` with `custom_domain: true` for apex and `www`), deploy.
1e. **Point nameservers to Cloudflare** (owner, at Hover): replace the NS1 nameservers
    (`dns1–4.p01.nsone.net`) with Cloudflare's two. Propagation ≤ 24 h. Site goes live on
    the real domain at this point; registration can stay at Hover indefinitely.
1f. **Optional registrar transfer to Cloudflare** (owner decision, Open #1c): at Hover unlock
    the domain and request the auth/EPP code; in Cloudflare → Domain Registration → Transfer.
    Costs one year's renewal at cost (~$10) and adds a year. Only possible ≥ 60 days after the
    last registrar change. Do this *after* 1e so it never blocks launch.
- Set `NEXT_PUBLIC_SITE_URL=https://awendajewelry.com` in production vars; `www` → apex 301.
- **Verify:** `dig NS awendajewelry.com` shows Cloudflare nameservers; `curl -I https://awendajewelry.com` → 200; `https://www.awendajewelry.com` → 301 to apex; SSL grade A on an SSL checker; Hover shows auto-renew on.

### 2. Transactional email domain
- Add the domain in Resend; add the DKIM/SPF/DMARC records in Cloudflare DNS; set `EMAIL_FROM = "Awenda Jewelry <orders@<domain>>"`.
- **Verify:** Resend shows "Verified"; a test order email lands in the owner's inbox, not spam (check headers `dkim=pass`).

### 3. Content
- Replace placeholders: About page (EN from owner, FR translated by agent and marked "review"), policies (shipping, returns — Open #4, privacy — template covering Stripe/Resend/Supabase processors and Cloudflare Web Analytics), pickup instructions, market details in `settings`, final logo/icons.
- **Verify:** owner reviews both locales; `grep -ri "placeholder\|lorem\|TODO" src messages` returns nothing.

### 4. Stripe live mode
- Owner completes Stripe activation and enters live keys via `wrangler secret put`. Create the live webhook endpoint in the Stripe dashboard (`https://<domain>/api/stripe/webhook`, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`) and set `STRIPE_WEBHOOK_SECRET`.
- Stripe Checkout branding (logo, colours) set in the dashboard; statement descriptor "AWENDA JEWELRY".
- **Verify:** owner makes a real $1 purchase (a temporary "test" design at $1), order appears in admin, email arrives, refund from admin succeeds, design deleted.

### 5. Production data
- Run `scripts/seed-admins.ts` against production with the real allowlist. Remove seed designs (`supabase db reset` is NOT allowed in prod — write a one-off `scripts/prod-clean-seed.ts` that deletes only rows whose slug starts with `seed-`).
- Storage bucket policies verified in the Supabase dashboard (public read, admin write).
- **Verify:** anon `select` from `public_designs` returns 0 rows before the owner catalogs; admin login works with the real email.

### 6. Backups (Supabase Free has none)
- GitHub Actions weekly cron: `supabase db dump --db-url $PROD_DB_URL -f dump.sql` (data + schema), plus `rclone` sync of the `photos` bucket via the S3-compatible endpoint, uploaded to a **private** Cloudflare R2 bucket (free 10 GB). Keep 8 weekly dumps.
- Document the restore procedure in `docs/runbook.md` and rehearse it once against local Supabase.
- **Verify:** workflow ran green; dump restores locally and `select count(*) from designs` matches prod.

### 7. Monitoring and keepalive check
- Cloudflare Web Analytics token added. Worker error alerting: enable Cloudflare notification for Worker error rate. Keepalive cron: verify in Supabase "last activity" that pings land every 3 days.
- Add `/api/health` (DB round-trip) and register it with a free uptime pinger of the owner's choice (e.g. an existing account) — **STOP if it requires a new paid vendor**.
- **Verify:** health returns `{ok:true}`; the uptime pinger shows green for 24 h.

### 8. Etsy and social
- Per Open #11: link to Etsy if still live, else nothing. Add Instagram/Facebook links to the footer if provided.
- **Verify:** links resolve.

### 9. Manual test day
- Owner runs one full market cycle with the real tooling: catalog ≥ 20 real designs, log real sales at the booth, reconcile that evening, fulfil at least one online pickup order. Capture friction in `docs/plan/DECISIONS.md` Open items and the top-1/top-3 stats from `/admin/reconcile/stats`.
- **Verify:** no `oversold` left unresolved; stats page has data.

### 10. README as case study
Structure:
1. One-line pitch: "Bilingual e-commerce + AI-assisted inventory reconciliation PWA for a family jewelry business selling online and at a weekly market."
2. Problem: dual-channel overselling with 2–3 units per design; 200–500 SKUs; must cost ~$0/mo.
3. Architecture diagram (from `00-overview.md §3`) and stack.
4. Key design decisions with the *why* (from `DECISIONS.md`): variants as counts not listings; gray-backdrop photos; AI proposes/human confirms; decrement-on-webhook with refund path; client-side image processing for Workers; keepalive cron.
5. Reconciliation accuracy numbers from the stats page (update quarterly).
6. Testing strategy and CI.
7. Local setup.
8. What I'd do next.
- **Verify:** owner approves; no customer/business-sensitive data or secrets in the README or repo history (`git log -p | grep -i "sk_live\|service_role"` returns nothing).

### 11. Handoff to the family
- One-page printable "How to hand over a pickup" for the parents (EN/FR): open `/admin/booth` → Pickups → tap name → Picked up. (Even though the owner operates admin, the parents may be at the booth alone.)
- **Verify:** parents complete a pickup unaided during the manual test day.

---

## Post-launch backlog (not scheduled — add only if the owner asks)
- Customer accounts / order history
- Discount codes
- Text search on the storefront
- Auto-translate product names with an LLM
- Soft-hold table for cart reservations if oversells become common
- International shipping
- Supabase Pro upgrade if storage > 800 MB or DB > 400 MB
