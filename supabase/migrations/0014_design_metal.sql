-- Structured metal (DECISIONS.md "Structured metal on designs", 2026-09-29):
-- the shop sells mostly stainless steel, some sterling silver, and the
-- storefront filters and labels by it. material_en/material_fr stay as free
-- text for detail ("316L, 18k PVD").
create type metal as enum ('stainless_steel', 'sterling_silver');

alter table designs
  add column metal metal not null default 'stainless_steel';

-- Re-declared from 0005_design_specs.sql with `metal` appended to the select
-- list; everything else identical. CREATE OR REPLACE VIEW only allows new
-- columns at the end.
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
  d.dimensions,
  d.metal
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

-- Same rationale as 0004/0005: re-apply the grants explicitly.
revoke all on public_designs from public, anon, authenticated;
grant select on public_designs to anon, authenticated;
