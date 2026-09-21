-- Phase 6 (DECISIONS.md "Shipping: CAD 12 flat, free over CAD 100"): the
-- Phase 2 placeholder rates (500 / 5000) are replaced with the owner's
-- real numbers. Guarded so this only touches a row still at the
-- placeholder — a hosted project where the owner has since edited the
-- rate via /admin/settings is left alone.
update settings
set shipping_flat_cents = 1200, free_shipping_threshold_cents = 10000
where id = 1 and shipping_flat_cents = 500;

-- Needed by Phase 6 step 8 (pickup reminder cron): tracks whether the
-- day-before-market reminder email has already gone out for an order.
alter table orders add column reminder_sent_at timestamptz;
