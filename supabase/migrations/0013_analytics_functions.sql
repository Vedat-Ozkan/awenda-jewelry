-- Phase 7 step 5: one aggregate for /admin/analytics, so the page makes a
-- single round trip and the numbers are testable against seeded rows.
--
-- p_from / p_to are inclusive calendar dates in the market's timezone
-- (settings.market_timezone; falls back to America/New_York if the row is
-- missing). Counts:
--   * sessions      = distinct analytics_events.session_id
--   * orders/revenue = orders that are not refunded/cancelled
--   * sold-out      = active designs whose variants sum to 0 on hand
--
-- security invoker (the default), not definer: the page calls it with the
-- admin's cookie session, so the is_admin() RLS policies on analytics_events,
-- orders, designs, variants and settings decide what is visible — a
-- non-admin would just see zeros. Execute is limited to signed-in users
-- (and service_role, which keeps its default grant, for tests).
create function analytics_summary(p_from date, p_to date)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tz text := coalesce((select market_timezone from settings where id = 1), 'America/New_York');
  v_start timestamptz := p_from::timestamp at time zone v_tz;
  v_end timestamptz := (p_to + 1)::timestamp at time zone v_tz;
  v_result jsonb;
begin
  with ev as (
    select * from analytics_events where occurred_at >= v_start and occurred_at < v_end
  ),
  ord as (
    select id, fulfillment, total_cents, (created_at at time zone v_tz)::date as local_day
    from orders
    where created_at >= v_start and created_at < v_end
      and status not in ('refunded', 'cancelled')
  ),
  days as (
    select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  ),
  weeks as (
    select w::date as week
    from generate_series(date_trunc('week', p_from::timestamp), p_to::timestamp, interval '1 week') w
  ),
  sold_out as (
    select d.id, d.slug, d.name_en
    from designs d
    where d.status = 'active'
      and coalesce((select sum(v.qty_on_hand) from variants v where v.design_id = d.id), 0) = 0
  )
  select jsonb_build_object(
    'sessions', (select count(distinct session_id) from ev),
    'design_views', (select count(*) from ev where event = 'design_view'),
    'add_to_carts', (select count(*) from ev where event = 'add_to_cart'),
    'begin_checkouts', (select count(*) from ev where event = 'begin_checkout'),
    'orders', (select count(*) from ord),
    'revenue_cents', (select coalesce(sum(total_cents), 0) from ord),
    'ship_orders', (select count(*) from ord where fulfillment = 'ship'),
    'pickup_orders', (select count(*) from ord where fulfillment = 'pickup'),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', days.day,
        'sessions', (select count(distinct session_id) from ev where (occurred_at at time zone v_tz)::date = days.day),
        'orders', (select count(*) from ord where ord.local_day = days.day)
      ) order by days.day), '[]'::jsonb)
      from days
    ),
    'revenue_by_week', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week', weeks.week,
        'revenue_cents', (
          select coalesce(sum(total_cents), 0) from ord
          where date_trunc('week', ord.local_day::timestamp)::date = weeks.week
        )
      ) order by weeks.week), '[]'::jsonb)
      from weeks
    ),
    'top_designs', (
      select coalesce(jsonb_agg(t order by t.views desc, t.name), '[]'::jsonb) from (
        select d.id as design_id, d.slug, d.name_en as name, count(*) as views
        from ev join designs d on d.id = ev.design_id
        where ev.event = 'design_view'
        group by d.id, d.slug, d.name_en
        order by count(*) desc, d.name_en
        limit 10
      ) t
    ),
    'sold_out_designs', (
      select coalesce(jsonb_agg(t order by t.views desc, t.name), '[]'::jsonb) from (
        select s.id as design_id, s.slug, s.name_en as name, count(*) as views
        from ev join sold_out s on s.id = ev.design_id
        where ev.event = 'design_view'
        group by s.id, s.slug, s.name_en
        order by count(*) desc, s.name_en
        limit 10
      ) t
    ),
    'referrers', (
      select coalesce(jsonb_agg(t order by t.sessions desc, t.host), '[]'::jsonb) from (
        select referrer_host as host, count(distinct session_id) as sessions
        from ev where referrer_host is not null
        group by referrer_host
        order by count(distinct session_id) desc, referrer_host
        limit 10
      ) t
    ),
    'locales', (
      select coalesce(jsonb_agg(t order by t.sessions desc, t.locale), '[]'::jsonb) from (
        select locale, count(distinct session_id) as sessions from ev group by locale
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(t order by t.sessions desc, t.device), '[]'::jsonb) from (
        select coalesce(device, 'unknown') as device, count(distinct session_id) as sessions
        from ev group by coalesce(device, 'unknown')
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke execute on function analytics_summary(date, date) from public, anon;
grant execute on function analytics_summary(date, date) to authenticated;
