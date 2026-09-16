-- Admin allowlist, seeded from ADMIN_EMAILS by scripts/seed-admins.ts.
create table admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

-- security definer so it can read admin_emails regardless of the caller's
-- RLS grants; stable because it only depends on the current JWT and the table.
create function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_emails where email = auth.jwt() ->> 'email');
$$;

-- security definer so this bypasses designs' own RLS (which has no
-- anon/authenticated policy) when checked from the design_images policy
-- below. Like is_admin(), it's invoked directly from a policy body executed
-- as the querying role, so anon/authenticated must keep EXECUTE on it.
create function design_is_published(p_design_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from designs where id = p_design_id and status <> 'draft');
$$;

-- Row level security: deny by default on every table. Only the two narrow
-- anon/authenticated read policies below (plus the views/storage policies)
-- and the admin "for all" policies grant anything.
alter table designs enable row level security;
alter table design_images enable row level security;
alter table variants enable row level security;
alter table inventory_movements enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table booth_sales enable row level security;
alter table settings enable row level security;
alter table admin_emails enable row level security;

create policy design_images_select_published on design_images
  for select
  to anon, authenticated
  using (design_is_published(design_images.design_id));

create policy designs_admin_all on designs
  for all using (is_admin()) with check (is_admin());
create policy design_images_admin_all on design_images
  for all using (is_admin()) with check (is_admin());
create policy variants_admin_all on variants
  for all using (is_admin()) with check (is_admin());
create policy inventory_movements_admin_all on inventory_movements
  for all using (is_admin()) with check (is_admin());
create policy orders_admin_all on orders
  for all using (is_admin()) with check (is_admin());
create policy order_items_admin_all on order_items
  for all using (is_admin()) with check (is_admin());
create policy booth_sales_admin_all on booth_sales
  for all using (is_admin()) with check (is_admin());
create policy settings_admin_all on settings
  for all using (is_admin()) with check (is_admin());
create policy admin_emails_admin_all on admin_emails
  for all using (is_admin()) with check (is_admin());

-- Public read views. Default (owner-executed) views run with the view
-- owner's privileges, so they can read the RLS-protected tables above even
-- though anon/authenticated have no policy on designs/settings directly.
create view public_designs as
select
  d.id,
  d.slug,
  d.category,
  d.name_en,
  d.name_fr,
  d.description_en,
  d.description_fr,
  d.price_cents,
  d.status,
  d.main_image_path,
  d.thumb_image_path,
  d.created_at,
  d.updated_at,
  coalesce(v.total_qty, 0) as total_qty,
  coalesce(v.variants, '[]'::json) as variants
from designs d
left join lateral (
  select
    sum(vv.qty_on_hand) as total_qty,
    json_agg(
      json_build_object('id', vv.id, 'label', vv.label, 'qty_on_hand', vv.qty_on_hand)
      order by vv.sort_order
    ) as variants
  from variants vv
  where vv.design_id = d.id
) v on true
where d.status <> 'draft';

create view public_settings as
select
  market_name,
  market_address,
  market_weekday,
  market_open_time,
  market_close_time,
  market_timezone,
  market_closed_until,
  market_closed_note_en,
  market_closed_note_fr,
  pickup_instructions_en,
  pickup_instructions_fr,
  shipping_enabled,
  shipping_flat_cents,
  free_shipping_threshold_cents,
  stripe_tax_enabled,
  variant_presets
from settings;

-- Simple views like these are auto-updatable by default, and the default
-- privileges for a new relation grant INSERT/UPDATE/DELETE to PUBLIC — which
-- would let anon/authenticated write through the view and, since the view
-- owner bypasses RLS, mutate designs/settings directly. Lock it down to
-- read-only before granting select.
revoke all on public_settings, public_designs from public, anon, authenticated;
grant select on public_settings, public_designs to anon, authenticated;

-- Storage: public bucket for design/booth photos, admin-only writes.
insert into storage.buckets (id, name, public) values ('photos', 'photos', true);

create policy photos_public_select on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'photos');

create policy photos_admin_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'photos' and is_admin());

create policy photos_admin_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'photos' and is_admin())
  with check (bucket_id = 'photos' and is_admin());

create policy photos_admin_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'photos' and is_admin());
