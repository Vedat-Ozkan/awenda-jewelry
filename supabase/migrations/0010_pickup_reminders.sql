-- Phase 6 step 8 (pickup reminder cron): selects `awaiting_pickup` orders
-- that haven't been reminded yet, where tomorrow (in the market's own
-- timezone, not the server's) is the next market date — i.e. the order is
-- ready for pickup at tomorrow's market.
--
-- Reimplements next_market_date()'s "roll forward to market_weekday, then
-- past market_closed_until" logic (0003_functions.sql) anchored at
-- p_today + 1 instead of "now", rather than calling next_market_date()
-- itself, because that function always anchors on the real clock. `p_today`
-- defaults to today in the market timezone but can be overridden so tests
-- don't have to mutate settings.market_weekday.
create function pickup_reminder_candidates(p_today date default null)
returns setof orders
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings settings%rowtype;
  v_today date;
  v_tomorrow date;
  v_next_market date;
begin
  select * into v_settings from settings where id = 1;
  if not found or v_settings.market_weekday is null then
    return;
  end if;

  v_today := coalesce(p_today, (now() at time zone v_settings.market_timezone)::date);
  v_tomorrow := v_today + 1;

  v_next_market := v_tomorrow;
  while extract(dow from v_next_market)::smallint <> v_settings.market_weekday loop
    v_next_market := v_next_market + 1;
  end loop;

  while v_settings.market_closed_until is not null
    and v_settings.market_closed_until >= v_next_market
  loop
    v_next_market := v_next_market + 7;
  end loop;

  if v_next_market <> v_tomorrow then
    return;
  end if;

  return query
    select * from orders
    where status = 'awaiting_pickup'
      and reminder_sent_at is null;
end;
$$;
-- Same posture as adjust_inventory()/bulk_restock(): only the service client
-- (the cron route) calls this.
revoke execute on function pickup_reminder_candidates(date) from public, anon, authenticated;
