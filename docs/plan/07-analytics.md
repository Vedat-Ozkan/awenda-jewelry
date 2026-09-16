# Phase 7 — Analytics and Leads

**Goal:** The owner can see whether the site gets traffic, where it comes from, whether it
converts, and which designs people want — plus capture leads — without cookies, consent
banners, or paid vendors.

**Branch:** `phase-7-analytics`
**Depends on:** Phase 5 (storefront), Phase 6 (orders).
**Definition of done:** Cloudflare Web Analytics receives beacons from the deployed site;
storefront events land in `analytics_events`; `/admin/analytics` shows the funnel, revenue,
top designs and leads for a chosen date range; "Notify me" and newsletter forms work in EN and
FR; nothing personal is stored except the emails people type in; e2e covers the funnel path.

> **STOP — ask the owner** before step 1: the Cloudflare Web Analytics site token (Open #18).

---

## Steps

### 1. Cloudflare Web Analytics
- Owner creates the site in the Cloudflare dashboard (Analytics & Logs → Web Analytics → Add
  site; automatic setup is not available for Workers, use the manual JS snippet). Token goes in
  `NEXT_PUBLIC_CF_BEACON_TOKEN` (`.env.example`, `wrangler.jsonc` `vars`).
- Add the beacon `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "…"}'>` to the storefront root layout only (not `/admin`), only when the token is set. Use `next/script` with `strategy="afterInteractive"`.
- **Verify:** on the preview build the request to `cloudflareinsights.com` returns 2xx; dashboard shows a visit within a few minutes of deploy.

### 2. Events table (migration `0005_analytics.sql`)
```sql
create type analytics_event as enum ('page_view','design_view','add_to_cart','begin_checkout');
create table analytics_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event analytics_event not null,
  session_id text not null,             -- random per browser session, from sessionStorage
  locale text not null,
  path text,                            -- page_view
  design_id uuid references designs on delete set null,
  variant_id uuid references variants on delete set null,
  referrer_host text,                   -- hostname only
  device text                           -- 'mobile' | 'desktop' (UA hint, coarse)
);
create index on analytics_events (occurred_at);
create index on analytics_events (event, occurred_at);
create index on analytics_events (design_id) where design_id is not null;

create table stock_notifications (
  id uuid primary key default gen_random_uuid(),
  email text not null, design_id uuid not null references designs on delete cascade,
  variant_id uuid references variants on delete set null,
  locale text not null default 'en',
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  notified_at timestamptz, unsubscribed_at timestamptz,
  unique (email, design_id)
);
create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null, locale text not null default 'en',
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(), unsubscribed_at timestamptz
);
```
- RLS enabled, **no anon policies** on any of the three (writes go through routes with the
  service client; admin reads via `is_admin()` policies).
- Retention: a `delete from analytics_events where occurred_at < now() - interval '13 months'`
  statement in the keepalive cron (it already runs every 3 days).
- **Verify:** `pnpm db:reset`; `pnpm db:types` no diff after commit; RLS test: anon cannot read or insert any of the three.

### 3. Tracking route and client hook
- `POST /api/track`: JSON `{ event, sessionId, locale, path?, designId?, variantId? }`. Validate
  with zod (enum, uuid, path ≤ 200 chars); derive `referrer_host` from the `Referer` header and
  `device` from `Sec-CH-UA-Mobile` / UA; drop everything else. Insert with the service client.
  Rate-limit trivially: reject bodies > 1 KB and unknown events. Always respond 204.
- `src/lib/analytics/client.ts`: `track(event, props)` using `navigator.sendBeacon`; session id
  from `sessionStorage` (`crypto.randomUUID()`), created on first call. Never called in `/admin`.
  Hooks: `page_view` on route change (storefront layout), `design_view` on product page mount,
  `add_to_cart` from the cart store, `begin_checkout` just before redirecting to Stripe.
- **Verify:** unit test for the route (valid → 204 + row, invalid → 204 + no row); e2e:
  browse home → product → add to cart, then the DB has the three events with one `session_id`.

### 4. Lead capture (storefront, EN/FR)
- Product page, when `total_qty = 0` (or the chosen variant is 0): **"Notify me when it's back"**
  email form → `POST /api/leads/notify` → upsert `stock_notifications`. Success copy translated.
- Footer newsletter field on every storefront page → `POST /api/leads/newsletter`.
- Both routes: zod email validation, service client, honeypot field, 1 KB body cap, 204 on
  duplicate. `GET /api/leads/unsubscribe?token=…` sets `unsubscribed_at` and renders a plain
  confirmation page in the user's locale.
- Sending the actual "it's back" email is a Phase 6 email template + a check in the restock
  bulk action (Phase 4 step 8): after a restock, queue one `back-in-stock` email per
  un-notified, un-unsubscribed row for that design, set `notified_at`. Implement here since
  both sides exist now.
- **Verify:** e2e submits both forms in FR; rows exist with `locale='fr'`; restocking the design
  via the admin bulk action sends the email through the Resend test sender (assert via the
  Resend mock/log) and sets `notified_at`.

### 5. Admin analytics page (`/admin/analytics`)
- Date range picker (7 / 30 / 90 days, custom). Server component; queries via the service
  client (or `security definer` SQL functions if the aggregates get heavy).
- Tiles: sessions, design views, add-to-carts, checkouts started, orders, revenue, conversion
  (orders ÷ sessions), AOV, ship vs pickup split.
- Charts: sessions and orders by day; revenue by week. Tables: top viewed designs, **most viewed
  sold-out designs** (demand you're missing), top referrer hosts, locale split, device split.
- Leads: counts and a table of `stock_notifications` (email, design, when, notified?) and
  `newsletter_subscribers`; **Export CSV** for each.
- Link to the Cloudflare Web Analytics dashboard for traffic detail (no need to reproduce it).
- Use the `dataviz` guidance for chart colours/marks; keep it to one small chart component.
- **Verify:** integration test of the aggregate query/function against seeded events; e2e:
  page renders tiles and the two tables for the seeded range; CSV download has a header row.

### 6. Docs and privacy
- `/[locale]/policies` privacy section: cookieless analytics (Cloudflare), first-party event
  collection, emails stored only for the purpose given, unsubscribe link. Owner reviews wording
  in Phase 9.
- README: analytics section.
- **Verify:** policy page renders the new section in both locales.

---

## Out of scope
GA4 or any cookie-based tracker; A/B testing; email campaigns beyond the transactional
back-in-stock notice (export the newsletter list instead).
