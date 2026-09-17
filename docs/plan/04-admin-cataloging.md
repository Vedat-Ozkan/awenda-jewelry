# Phase 4 — Admin: Auth and Cataloging

**Goal:** The owner can log in, add a design from a phone photo in under 60 seconds, edit it,
manage variants and stock, and perform bulk operations across the catalog.

**Branch:** `phase-4-admin-catalog`
**Depends on:** Phase 3.
**Definition of done:** Playwright e2e creates a design with two variants from a fixture photo,
publishes it, edits price, restocks, archives via bulk action; all admin routes 401/redirect
for anonymous and non-allowlisted users.

> ~~STOP — ask the owner~~ **Resolved 2026-09-16:** `ADMIN_EMAILS` = owner only (Open #9); French
> copy optional with EN fallback (Open #5); optional spec fields `material_en/fr`, `dimensions`
> (Open #19) — migration `0005_design_specs.sql` in step 4.

> **Amended 2026-09-16:** eight categories; step 4 supports multi-file import. No SKU/label
> sheet — booth integration is deferred (`DECISIONS.md` "Separate online stock at launch").

---

## Steps

### 1. Admin auth
- Supabase Auth **magic link (email OTP)**. `/admin/login` page: email input → "Send link".
  Server-side: reject emails not in `admin_emails` before sending (avoid spamming strangers).
- Middleware (`src/middleware.ts`): `/admin/*` (except `/admin/login`) requires a session whose
  email is in `admin_emails`; otherwise redirect to login. `requireAdmin()` (Phase 3) used in all admin route handlers and server actions.
- Local dev: Supabase local Inbucket shows the link (document in README).
- Tests: helper `loginAsAdmin(page)` that creates a session via the service-role admin API and sets cookies.
- **Verify:** e2e — anonymous → redirected; allowlisted user → sees `/admin`; non-allowlisted email gets "not allowed" without an email being sent (assert via Inbucket API).

### 2. Admin shell
- `/admin` layout: mobile-first, bottom nav with **Catalog · Orders · Analytics · Settings**. Orders/Analytics are placeholders until their phases.
- PWA manifest `start_url` = `/admin`.
- **Verify:** renders on a 390 px wide viewport without horizontal scroll.

### 3. Catalog list (`/admin/catalog`)
- Table/cards: thumb, name, category, price, total qty, status; filters by category/status; search by name.
- Multi-select checkboxes → bulk action bar (step 8).
- **Verify:** seed data renders; filters and search work (e2e).

### 4. New design flow (`/admin/catalog/new`) — optimised for speed
1. **Photo** first: camera input, `multiple` allowed (select many from a folder → one draft
   design per file, then step through details for each); show reminder "Gray tray, item
   centered, no hands". Preview immediately from the resized `main` blob.
2. **Category** (8 big buttons) → **Variants**: presets for the category appear as toggle chips
   with a stepper each (default 1 when toggled on); "+ custom" adds a free-text label.
3. **Name (EN)**, **Price** (numeric keypad, CAD), optional **Description (EN)**, optional
   **Material (EN)** and **Dimensions** (free text). Migration `0005_design_specs.sql` adds
   `material_en`, `material_fr`, `dimensions` (all nullable text) and exposes them in `public_designs`.
4. **Save as draft** or **Publish**.
- On submit: server action creates the `designs` row (slug from name + short id), creates
  variants via `adjust_inventory(…, 'catalog')` so the ledger starts at the initial count,
  then calls the photo route (Phase 3 step 3). Show a progress state; embedding failure keeps
  the design as draft with an "Embedding failed — retry" badge.
- **Verify:** e2e creates a design in ≤ 4 screens; DB shows variants, movements with reason `catalog`, image paths, and (fake) embedding.

### 5. Edit design (`/admin/catalog/[id]`)
- Edit all fields; replace main photo (re-embeds); add/remove extra photos (display only, no embedding); reorder.
- Variants: add/remove labels; **quantity changes go through `adjust_inventory` with reason
  `restock` (positive) or `adjustment` (negative)** and an optional note — never a direct update.
- Show the movement ledger for this design (last 20).
- Status: draft / active / archived.
- **Verify:** e2e edits price and restocks; ledger shows the restock; direct `update variants set qty_on_hand` by the admin role is blocked by a trigger (`raise` unless called from `adjust_inventory`) — add that trigger in a migration here and test it.

### 6. French fields
- Resolved as (b): `name_fr` / `description_fr` / `material_fr` optional inputs with a "Falls back to English" hint. No translation vendor.
- **Verify:** storefront (Phase 5) falls back correctly — covered there.

### 7. Slug and SEO fields
- Slug auto-generated, editable, unique; changing slug keeps a `previous_slugs text[]` for 301s (Phase 5).
- **Verify:** unit test for slugify (accents from FR names handled: "Collier Été" → `collier-ete`).

### 8. Bulk operations (from catalog list)
- Actions on selected: **Archive**, **Activate**, **Restock +N** (applies to all variants of the selection with a note), **Set price**, **Export CSV** (designs + variants + qty).
- All in one server action per operation, inside a transaction.
- **Verify:** e2e selects 3 designs → Archive → statuses updated; Restock +1 → 1 movement per variant.

### 9. Settings page (`/admin/settings`)
- Edit `settings` row: market details, closed-until + notes (EN/FR), shipping toggle/rates, tax toggle (display only until Phase 6), variant presets (JSON editor with validation), pickup instructions EN/FR.
- **Verify:** e2e changes `shipping_flat_cents`; `next_market_date()` reflects `market_closed_until`.

---

## Out of scope
Storefront, orders, analytics. Any auth beyond magic link.
