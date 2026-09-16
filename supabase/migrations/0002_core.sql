-- Enums
create type category as enum ('necklace','bracelet','anklet','ring','earring','bangle','chain','pendant');
create type design_status as enum ('draft','active','archived');
create type fulfillment_type as enum ('ship','pickup');
create type order_status as enum ('paid','awaiting_pickup','picked_up','awaiting_shipment','shipped','refunded','cancelled');
create type booth_sale_status as enum ('pending','matched','unmatched','oversold');
create type movement_reason as enum ('catalog','restock','adjustment','online_order','booth_sale','refund','reconcile_undo');

-- Generic trigger function applied to every table that has an updated_at column.
create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
-- Only ever invoked by the triggers below, never called directly; trigger
-- firing does not require the invoking role to hold EXECUTE, so this is safe.
revoke execute on function set_updated_at() from public, anon, authenticated;

create table designs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category category not null,
  name_en text not null,
  name_fr text,
  description_en text,
  description_fr text,
  price_cents int not null check (price_cents > 0),
  status design_status not null default 'draft',
  main_image_path text,
  thumb_image_path text,
  embedding vector(1024),
  embedded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index designs_embedding_idx on designs using hnsw (embedding vector_cosine_ops);
create index designs_status_category_idx on designs (status, category);
create trigger designs_set_updated_at
  before update on designs
  for each row execute function set_updated_at();

create table design_images (            -- extra display-only photos
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs on delete cascade,
  main_image_path text not null,
  thumb_image_path text not null,
  sort_order int not null default 0
);

create table variants (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs on delete cascade,
  label text not null,                   -- '7', '18"', 'One size' — language-neutral
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  sort_order int not null default 0,
  unique (design_id, label)
);

create table inventory_movements (       -- append-only ledger
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references variants,
  delta int not null,
  reason movement_reason not null,
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text unique not null,
  stripe_payment_intent_id text,
  status order_status not null,
  fulfillment fulfillment_type not null,
  locale text not null default 'en',
  customer_name text,
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb,                -- null for pickup
  subtotal_cents int not null,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null,
  tracking_number text,
  tracking_url text,
  picked_up_at timestamptz,
  shipped_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  variant_id uuid references variants,
  design_id uuid references designs,
  name_snapshot text not null,
  variant_label_snapshot text not null,
  unit_price_cents int not null,
  qty int not null check (qty > 0),
  fulfilled boolean not null default true  -- false if auto-refunded for insufficient stock
);

create table booth_sales (
  id uuid primary key default gen_random_uuid(),
  sold_on date not null default current_date,
  category category not null,
  variant_label text not null,
  photo_main_path text not null,
  photo_thumb_path text not null,
  price_paid_cents int,                  -- optional
  status booth_sale_status not null default 'pending',
  matched_variant_id uuid references variants,
  matched_rank smallint,                 -- 1..3 or null (manual search)
  candidates jsonb,                      -- cached top-k at reconcile time [{design_id, distance}]
  embedding vector(1024),
  embedded_at timestamptz,
  reconciled_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table settings (                  -- single row, id = 1
  id int primary key check (id = 1),
  market_name text,
  market_address text,
  market_weekday smallint,               -- 0=Sunday
  market_open_time time,
  market_close_time time,
  market_timezone text not null default 'America/New_York',
  market_closed_until date,
  market_closed_note_en text,
  market_closed_note_fr text,
  pickup_instructions_en text,
  pickup_instructions_fr text,
  shipping_enabled boolean not null default false,
  shipping_flat_cents int not null default 500,
  free_shipping_threshold_cents int,     -- null = never free
  stripe_tax_enabled boolean not null default false,
  variant_presets jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger settings_set_updated_at
  before update on settings
  for each row execute function set_updated_at();
