-- Optional spec fields (Phase 4 step 4, DECISIONS.md "Product spec fields",
-- 2026-09-16) plus previous_slugs for 301s when a slug changes (Phase 4 step 7).
alter table designs
  add column material_en text,
  add column material_fr text,
  add column dimensions text,
  add column previous_slugs text[] not null default '{}';

-- Re-declared from 0004_rls.sql with the three spec columns added to the
-- select list; everything else identical.
create or replace view public_designs as
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
  coalesce(v.variants, '[]'::json) as variants,
  d.material_en,
  d.material_fr,
  d.dimensions
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

-- Same rationale as 0004_rls.sql: CREATE OR REPLACE VIEW's ACLs should carry
-- over unchanged, but re-apply explicitly so this migration doesn't depend on
-- that behaviour.
revoke all on public_designs from public, anon, authenticated;
grant select on public_designs to anon, authenticated;

-- Inventory guard: variants.qty_on_hand may only change through
-- adjust_inventory(). Inserts are unguarded (seed data and tests create
-- variants directly with their initial qty_on_hand); this only fires on
-- UPDATE of that column.
create function guard_qty_on_hand()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('awenda.inventory_adjust', true), '') <> 'on' then
    raise exception 'use adjust_inventory()';
  end if;
  return new;
end;
$$;
revoke execute on function guard_qty_on_hand() from public, anon, authenticated;

create trigger variants_guard_qty_on_hand
  before update of qty_on_hand on variants
  for each row execute function guard_qty_on_hand();

-- Re-declared from 0003_functions.sql with a set_config() call added at the
-- top: sets the awenda.inventory_adjust GUC for the rest of this transaction
-- so the trigger above lets this function's own update through. `is_local =
-- true` means it resets automatically at transaction end, so it never leaks
-- into any other statement.
create or replace function adjust_inventory(
  p_variant_id uuid,
  p_delta int,
  p_reason movement_reason,
  p_ref_id uuid default null,
  p_note text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty int;
begin
  perform set_config('awenda.inventory_adjust', 'on', true);

  update variants
  set qty_on_hand = qty_on_hand + p_delta
  where id = p_variant_id and qty_on_hand + p_delta >= 0
  returning qty_on_hand into v_qty;

  if not found then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;
  -- Re-arm the guard for the rest of the transaction (PERFORM would clobber FOUND above).
  perform set_config('awenda.inventory_adjust', 'off', true);

  insert into inventory_movements (variant_id, delta, reason, ref_id, note)
  values (p_variant_id, p_delta, p_reason, p_ref_id, p_note);

  return v_qty;
end;
$$;
