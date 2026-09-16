# Phase 2 — Data Model

**Goal:** Complete Postgres schema with RLS, the `adjust_inventory()` function and ledger,
vector search function stub, settings, seed data, and integration tests proving the inventory
invariants.

**Branch:** `phase-2-data-model`
**Depends on:** Phase 1.
**Definition of done:** `pnpm db:reset` applies all migrations; `pnpm db:types` regenerates
types with no diff in CI; integration tests for inventory pass; anon role can read only
published designs and nothing else.

> **STOP — ask the owner** (before step 2): ~~confirm the category list and the default variant presets~~
> **Resolved 2026-09-16** — eight categories and presets below; market details are placeholders
> (see `DECISIONS.md` Locked entries of that date).

---

## Schema (migration `0002_core.sql`)

All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`,
`updated_at` maintained by a trigger.

```sql
create type category as enum ('necklace','bracelet','anklet','ring','earring','bangle','chain','pendant');
create type design_status as enum ('draft','active','archived');
create type fulfillment_type as enum ('ship','pickup');
create type order_status as enum ('paid','awaiting_pickup','picked_up','awaiting_shipment','shipped','refunded','cancelled');
create type booth_sale_status as enum ('pending','matched','unmatched','oversold');
create type movement_reason as enum ('catalog','restock','adjustment','online_order','booth_sale','refund','reconcile_undo');

create table designs (
  id, slug text unique not null, category category not null,
  name_en text not null, name_fr text,
  description_en text, description_fr text,
  price_cents int not null check (price_cents > 0),
  status design_status not null default 'draft',
  main_image_path text, thumb_image_path text,          -- Supabase Storage paths
  embedding vector(1024),                                -- dims verified in Phase 3
  embedded_at timestamptz,
  created_at, updated_at
);
create index on designs using hnsw (embedding vector_cosine_ops);
create index on designs (status, category);

create table design_images (            -- extra display-only photos
  id, design_id uuid references designs on delete cascade,
  main_image_path text not null, thumb_image_path text not null, sort_order int not null default 0
);

create table variants (
  id, design_id uuid references designs on delete cascade,
  label text not null,                   -- '7', '18"', 'One size' — language-neutral
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  sort_order int not null default 0,
  unique (design_id, label)
);

create table inventory_movements (       -- append-only ledger
  id, variant_id uuid references variants, delta int not null,
  reason movement_reason not null, ref_id uuid, note text, created_at
);

create table orders (
  id, stripe_checkout_session_id text unique not null, stripe_payment_intent_id text,
  status order_status not null, fulfillment fulfillment_type not null,
  locale text not null default 'en',
  customer_name text, customer_email text not null, customer_phone text,
  shipping_address jsonb,                -- null for pickup
  subtotal_cents int not null, shipping_cents int not null default 0,
  tax_cents int not null default 0, total_cents int not null,
  tracking_number text, tracking_url text,
  picked_up_at timestamptz, shipped_at timestamptz, refunded_at timestamptz,
  created_at, updated_at
);

create table order_items (
  id, order_id uuid references orders on delete cascade,
  variant_id uuid references variants, design_id uuid references designs,
  name_snapshot text not null, variant_label_snapshot text not null,
  unit_price_cents int not null, qty int not null check (qty > 0),
  fulfilled boolean not null default true  -- false if auto-refunded for insufficient stock
);

create table booth_sales (
  id, sold_on date not null default current_date,
  category category not null, variant_label text not null,
  photo_main_path text not null, photo_thumb_path text not null,
  price_paid_cents int,                  -- optional
  status booth_sale_status not null default 'pending',
  matched_variant_id uuid references variants, matched_rank smallint, -- 1..5 or null (manual search)
  candidates jsonb,                      -- cached top-k at reconcile time [{design_id, distance}]
  embedding vector(1024), embedded_at timestamptz,
  reconciled_at timestamptz, note text, created_at
);

create table settings (                  -- single row, id = 1
  id int primary key check (id = 1),
  market_name text, market_address text, market_weekday smallint, -- 0=Sunday
  market_open_time time, market_close_time time,
  market_timezone text not null default 'America/New_York',  -- IANA; market times are local
  market_closed_until date, market_closed_note_en text, market_closed_note_fr text,
  pickup_instructions_en text, pickup_instructions_fr text,
  shipping_enabled boolean not null default false,
  shipping_flat_cents int not null default 500,
  free_shipping_threshold_cents int,     -- null = never free
  stripe_tax_enabled boolean not null default false,
  variant_presets jsonb not null,        -- {"ring":["5","6","7","8","9","10"],"necklace":["16\"","18\"","20\""],...}
  updated_at
);
```

Default `variant_presets` (confirmed by owner 2026-09-16 — loose defaults, edited in settings later):
```json
{ "ring": ["5","6","7","8","9","10"],
  "necklace": ["16\"","18\"","20\"","24\""],
  "chain": ["16\"","18\"","20\"","24\""],
  "bracelet": ["6.5\"","7\"","7.5\"","8\""],
  "anklet": ["9\"","10\""],
  "bangle": ["Small","Medium","Large"],
  "earring": ["One size"],
  "pendant": ["One size"] }
```

## Functions (migration `0003_functions.sql`)

```sql
-- The only way quantities change. Raises 'insufficient_stock' if it would go negative.
create function adjust_inventory(p_variant_id uuid, p_delta int, p_reason movement_reason,
                                 p_ref_id uuid default null, p_note text default null)
returns int language plpgsql security definer as $$ … $$;
--   update variants set qty_on_hand = qty_on_hand + p_delta
--     where id = p_variant_id and qty_on_hand + p_delta >= 0 returning qty_on_hand into v;
--   if not found then raise exception 'insufficient_stock' using errcode = 'P0001'; end if;
--   insert into inventory_movements(...) …; return v;

-- Vector search. Real use in Phase 3; created here so types exist.
create function match_designs(query_embedding vector(1024), match_count int default 3,
                              p_category category default null)
returns table (design_id uuid, distance float) …
--   select id, embedding <=> query_embedding from designs
--   where embedding is not null and status <> 'draft' and (p_category is null or category = p_category)
--   order by 2 limit match_count;

-- Next market date, honouring market_closed_until. Compares against now() in
-- settings.market_timezone (server time is UTC); returns null if unconfigured.
create function next_market_date() returns date …;

-- Revoke EXECUTE from public/anon/authenticated on adjust_inventory and match_designs:
-- Supabase grants EXECUTE on new public functions to everyone by default.
```

## Views and RLS (migration `0004_rls.sql`)

- `public_designs` view: active + archived designs (archived shown greyed), no `embedding`,
  plus `total_qty` = sum of variant qty and a `variants` json array `[{id,label,qty_on_hand}]`.
- Enable RLS on every table. Views: `revoke all … from anon, authenticated` then `grant select` —
  simple views are auto-updatable and default privileges would let anon write through them. Policies:
  - `anon` / `authenticated`: `select` on `public_designs`, `design_images` (for non-draft — via a
    `security definer` helper `design_is_published()`; a bare `exists(select … from designs)` in a
    policy is itself filtered by `designs`' RLS and matches nothing), `settings` (read-only columns only via a `public_settings` view — exclude nothing sensitive, but keep the pattern).
  - Admin (`auth.jwt() ->> 'email'` in the `admin_emails` table — a tiny table seeded from `ADMIN_EMAILS` by a script) : full access on all tables.
  - Service role bypasses RLS (webhook, cron, embeddings).
- Storage: bucket `photos` (public read, admin write) with paths `designs/<id>/main.jpg|thumb.jpg`, `designs/<id>/extra/<n>-…`, `booth/<date>/<id>-main.jpg|thumb.jpg`.

## Steps

1. Write migrations `0002`–`0004` as above. **Verify:** `pnpm db:reset` clean; `pnpm db:types` succeeds.
2. Seed script `supabase/seed.sql`: settings row with placeholders, 16 designs across all eight
   categories (using placeholder images from `public/seed/` — plain gray squares with a label,
   not real product photos), each with 1–3 variants, some at qty 0. **Verify:** `select count(*) from designs` = 16.
3. `scripts/seed-admins.ts` reading `ADMIN_EMAILS` → upsert into `admin_emails`. **Verify:** row present.
4. Integration tests (`tests/integration/inventory.test.ts`) against local Supabase using the service client:
   - `adjust_inventory` decrements and writes a movement.
   - Decrementing below zero raises `insufficient_stock` and writes nothing.
   - Concurrent decrements of the last unit: run two in parallel; exactly one succeeds.
   - `next_market_date()` returns the coming weekday; respects `market_closed_until`.
   **Verify:** tests pass.
5. RLS tests (`tests/integration/rls.test.ts`) with the anon client: can read `public_designs`; cannot read `orders`, `booth_sales`, `inventory_movements`, or `designs.embedding`; cannot insert anywhere. **Verify:** pass.
6. Regenerate types and commit `database.types.ts`. Add a CI step that fails if `pnpm db:types` produces a diff. **Verify:** CI green.
7. Keepalive route now runs `select 1` via service client (`/api/keepalive`). **Verify:** curl with secret returns `{ok:true}`; without → 401.

## Out of scope
Any UI. Embedding generation (Phase 3).
