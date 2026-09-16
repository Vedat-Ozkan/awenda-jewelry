-- The only way variant quantities change. Raises 'insufficient_stock' (P0001)
-- if the delta would take qty_on_hand below zero; otherwise appends a row to
-- the inventory_movements ledger alongside the update.
create function adjust_inventory(
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
  update variants
  set qty_on_hand = qty_on_hand + p_delta
  where id = p_variant_id and qty_on_hand + p_delta >= 0
  returning qty_on_hand into v_qty;

  if not found then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;

  insert into inventory_movements (variant_id, delta, reason, ref_id, note)
  values (p_variant_id, p_delta, p_reason, p_ref_id, p_note);

  return v_qty;
end;
$$;
-- Only service_role (webhook, cron, reconciliation) should ever change
-- inventory; anon/authenticated must never be able to call this directly.
revoke execute on function adjust_inventory(uuid, int, movement_reason, uuid, text)
  from public, anon, authenticated;

-- Vector search over publishable designs. Real use starts in Phase 3; created
-- here so the generated types exist ahead of time.
create function match_designs(
  query_embedding vector(1024),
  match_count int default 3,
  p_category category default null
)
returns table (design_id uuid, distance float)
language sql
stable
as $$
  select id, embedding <=> query_embedding as distance
  from designs
  where embedding is not null
    and status <> 'draft'
    and (p_category is null or category = p_category)
  order by distance
  limit match_count;
$$;
-- Nothing public should call this until Phase 3 wires up real embeddings and
-- decides how it's exposed (direct RPC vs. a wrapper with its own checks).
revoke execute on function match_designs(vector, int, category)
  from public, anon, authenticated;

-- Next date the market runs, in the market's own timezone (not the server's).
-- Today counts if today is market day and it's before market_close_time.
-- Advances weekly past market_closed_until when set. Returns null if the
-- settings row is missing or market_weekday isn't configured yet, rather
-- than looping forever. security definer because settings has no
-- anon/authenticated select policy; stays callable by anon (storefront
-- needs "next market date").
create function next_market_date()
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings settings%rowtype;
  v_today date;
  v_date date;
begin
  select * into v_settings from settings where id = 1;
  if not found or v_settings.market_weekday is null then
    return null;
  end if;

  v_today := (now() at time zone v_settings.market_timezone)::date;
  v_date := v_today;

  if extract(dow from v_date)::smallint = v_settings.market_weekday
     and (now() at time zone v_settings.market_timezone)::time < v_settings.market_close_time then
    -- today is market day and it hasn't closed yet; today counts
    null;
  else
    loop
      v_date := v_date + 1;
      exit when extract(dow from v_date)::smallint = v_settings.market_weekday;
    end loop;
  end if;

  while v_settings.market_closed_until is not null
    and v_settings.market_closed_until >= v_date
  loop
    v_date := v_date + 7;
  end loop;

  return v_date;
end;
$$;
