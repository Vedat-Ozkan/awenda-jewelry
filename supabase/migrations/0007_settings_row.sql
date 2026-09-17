-- The single settings row (id = 1) is part of the schema, not seed data:
-- the hosted project receives migrations but never seed.sql, and both the
-- storefront and the admin settings page assume the row exists. Values are
-- the Phase 2 placeholders (DECISIONS.md "Market details: placeholders").
insert into settings (
  id, market_name, market_address, market_weekday,
  market_open_time, market_close_time,
  pickup_instructions_en, pickup_instructions_fr,
  shipping_enabled, shipping_flat_cents, free_shipping_threshold_cents,
  stripe_tax_enabled, variant_presets
) values (
  1, 'Weekly Market', 'TBD', 6,
  '09:00', '14:00',
  'TBD', 'À déterminer',
  false, 500, 5000,
  false,
  '{
    "ring": ["5","6","7","8","9","10"],
    "necklace": ["16\"","18\"","20\"","24\""],
    "chain": ["16\"","18\"","20\"","24\""],
    "bracelet": ["6.5\"","7\"","7.5\"","8\""],
    "anklet": ["9\"","10\""],
    "bangle": ["Small","Medium","Large"],
    "earring": ["One size"],
    "pendant": ["One size"]
  }'::jsonb
)
on conflict (id) do nothing;
