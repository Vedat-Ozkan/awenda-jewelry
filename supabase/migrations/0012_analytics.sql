-- Phase 7 step 2: first-party funnel events + lead capture tables
-- (docs/plan/07-analytics.md; DECISIONS.md "Analytics and lead capture").
--
-- Numbered 0012, not the phase file's 0005 — migrations 0005-0011 already exist.
--
-- RLS is on with no anon/authenticated-visitor policies: every write goes
-- through a route handler using the service client (bypasses RLS), and the
-- admin reads via the is_admin() policies below (same pattern as 0004_rls.sql).

create type analytics_event as enum ('page_view', 'design_view', 'add_to_cart', 'begin_checkout');

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
  email text not null,
  design_id uuid not null references designs on delete cascade,
  variant_id uuid references variants on delete set null,
  locale text not null default 'en',
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unsubscribed_at timestamptz,
  unique (email, design_id)
);

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  locale text not null default 'en',
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table analytics_events enable row level security;
alter table stock_notifications enable row level security;
alter table newsletter_subscribers enable row level security;

create policy analytics_events_admin_read on analytics_events
  for select using (is_admin());
create policy stock_notifications_admin_read on stock_notifications
  for select using (is_admin());
create policy newsletter_subscribers_admin_read on newsletter_subscribers
  for select using (is_admin());
