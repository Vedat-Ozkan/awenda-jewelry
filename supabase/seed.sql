-- Local/dev seed data. Applied by `pnpm db:reset`. Never run against a
-- production project (would collide with real slugs/ids).
--
-- Image paths below point at public/seed/<slug>.svg — plain gray placeholder
-- squares committed to the Next.js app, NOT Supabase Storage objects. Phase 3
-- replaces them with real Storage paths once the upload pipeline exists.

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
on conflict (id) do nothing; -- row is created by migration 0007

-- 16 designs, 2 per category. Design #10 (stud-earring-os) is sold out (its
-- only variant is at qty 0). Design #4 is archived, #8 is a draft, the rest
-- are active.
insert into designs (id, slug, category, name_en, name_fr, price_cents, status, main_image_path, thumb_image_path) values
('a0000000-0000-4000-8000-000000000001', 'silver-necklace-16', 'necklace', 'Silver Necklace', 'Collier en Argent', 4500, 'active', 'seed/silver-necklace-16.svg', 'seed/silver-necklace-16.svg'),
('a0000000-0000-4000-8000-000000000002', 'gold-necklace-20', 'necklace', 'Gold Necklace', null, 8900, 'active', 'seed/gold-necklace-20.svg', 'seed/gold-necklace-20.svg'),
('a0000000-0000-4000-8000-000000000003', 'pearl-bracelet-7', 'bracelet', 'Pearl Bracelet', 'Bracelet en Perles', 2200, 'active', 'seed/pearl-bracelet-7.svg', 'seed/pearl-bracelet-7.svg'),
('a0000000-0000-4000-8000-000000000004', 'chain-bracelet-8', 'bracelet', 'Chain Bracelet', null, 3100, 'archived', 'seed/chain-bracelet-8.svg', 'seed/chain-bracelet-8.svg'),
('a0000000-0000-4000-8000-000000000005', 'gold-anklet-9', 'anklet', 'Gold Anklet', 'Chaîne de Cheville en Or', 2600, 'active', 'seed/gold-anklet-9.svg', 'seed/gold-anklet-9.svg'),
('a0000000-0000-4000-8000-000000000006', 'silver-anklet-10', 'anklet', 'Silver Anklet', null, 1900, 'active', 'seed/silver-anklet-10.svg', 'seed/silver-anklet-10.svg'),
('a0000000-0000-4000-8000-000000000007', 'silver-ring-7', 'ring', 'Silver Ring', 'Bague en Argent', 1800, 'active', 'seed/silver-ring-7.svg', 'seed/silver-ring-7.svg'),
('a0000000-0000-4000-8000-000000000008', 'gold-ring-8', 'ring', 'Gold Ring', null, 6200, 'draft', 'seed/gold-ring-8.svg', 'seed/gold-ring-8.svg'),
('a0000000-0000-4000-8000-000000000009', 'hoop-earring-os', 'earring', 'Hoop Earrings', 'Boucles d''Oreilles Anneaux', 1500, 'active', 'seed/hoop-earring-os.svg', 'seed/hoop-earring-os.svg'),
('a0000000-0000-4000-8000-000000000010', 'stud-earring-os', 'earring', 'Stud Earrings', null, 1700, 'active', 'seed/stud-earring-os.svg', 'seed/stud-earring-os.svg'),
('a0000000-0000-4000-8000-000000000011', 'silver-bangle-md', 'bangle', 'Silver Bangle', 'Bracelet Jonc en Argent', 3300, 'active', 'seed/silver-bangle-md.svg', 'seed/silver-bangle-md.svg'),
('a0000000-0000-4000-8000-000000000012', 'gold-bangle-sm', 'bangle', 'Gold Bangle', null, 7600, 'active', 'seed/gold-bangle-sm.svg', 'seed/gold-bangle-sm.svg'),
('a0000000-0000-4000-8000-000000000013', 'silver-chain-18', 'chain', 'Silver Chain', 'Chaîne en Argent', 4100, 'active', 'seed/silver-chain-18.svg', 'seed/silver-chain-18.svg'),
('a0000000-0000-4000-8000-000000000014', 'gold-chain-18', 'chain', 'Gold Chain', null, 9200, 'active', 'seed/gold-chain-18.svg', 'seed/gold-chain-18.svg'),
('a0000000-0000-4000-8000-000000000015', 'heart-pendant-os', 'pendant', 'Heart Pendant', 'Pendentif Cœur', 2900, 'active', 'seed/heart-pendant-os.svg', 'seed/heart-pendant-os.svg'),
('a0000000-0000-4000-8000-000000000016', 'star-pendant-os', 'pendant', 'Star Pendant', null, 3400, 'active', 'seed/star-pendant-os.svg', 'seed/star-pendant-os.svg');

-- Variants, seeded directly (not via adjust_inventory). Several are at 0;
-- stud-earring-os's only variant is 0, making it fully sold out.
insert into variants (id, design_id, label, qty_on_hand, sort_order) values
('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '16"', 3, 0),
('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '18"', 2, 1),
('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', '20"', 0, 0),
('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', '24"', 1, 1),
('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003', '6.5"', 4, 0),
('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', '7"', 0, 1),
('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004', '7.5"', 2, 0),
('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000004', '8"', 2, 1),
('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005', '9"', 3, 0),
('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000005', '10"', 3, 1),
('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000006', '9"', 0, 0),
('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000006', '10"', 2, 1),
('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000007', '6', 5, 0),
('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000007', '7', 3, 1),
('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000007', '8', 0, 2),
('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000008', '7', 2, 0),
('b0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000008', '8', 2, 1),
('b0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000009', 'One size', 6, 0),
('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000010', 'One size', 0, 0),
('b0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000011', 'Small', 2, 0),
('b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000011', 'Medium', 3, 1),
('b0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000011', 'Large', 0, 2),
('b0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000012', 'Medium', 4, 0),
('b0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000012', 'Large', 2, 1),
('b0000000-0000-4000-8000-000000000025', 'a0000000-0000-4000-8000-000000000013', '16"', 3, 0),
('b0000000-0000-4000-8000-000000000026', 'a0000000-0000-4000-8000-000000000013', '18"', 1, 1),
('b0000000-0000-4000-8000-000000000027', 'a0000000-0000-4000-8000-000000000014', '18"', 2, 0),
('b0000000-0000-4000-8000-000000000028', 'a0000000-0000-4000-8000-000000000014', '20"', 0, 1),
('b0000000-0000-4000-8000-000000000029', 'a0000000-0000-4000-8000-000000000014', '24"', 1, 2),
('b0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000015', 'One size', 5, 0),
('b0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000016', 'One size', 3, 0);

-- Matching ledger rows for every variant seeded above 0, so the ledger
-- reconciles to stock (sum of movements per variant = qty_on_hand).
insert into inventory_movements (variant_id, delta, reason) values
('b0000000-0000-4000-8000-000000000001', 3, 'catalog'),
('b0000000-0000-4000-8000-000000000002', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000004', 1, 'catalog'),
('b0000000-0000-4000-8000-000000000005', 4, 'catalog'),
('b0000000-0000-4000-8000-000000000007', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000008', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000009', 3, 'catalog'),
('b0000000-0000-4000-8000-000000000010', 3, 'catalog'),
('b0000000-0000-4000-8000-000000000012', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000013', 5, 'catalog'),
('b0000000-0000-4000-8000-000000000014', 3, 'catalog'),
('b0000000-0000-4000-8000-000000000016', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000017', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000018', 6, 'catalog'),
('b0000000-0000-4000-8000-000000000020', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000021', 3, 'catalog'),
('b0000000-0000-4000-8000-000000000023', 4, 'catalog'),
('b0000000-0000-4000-8000-000000000024', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000025', 3, 'catalog'),
('b0000000-0000-4000-8000-000000000026', 1, 'catalog'),
('b0000000-0000-4000-8000-000000000027', 2, 'catalog'),
('b0000000-0000-4000-8000-000000000029', 1, 'catalog'),
('b0000000-0000-4000-8000-000000000030', 5, 'catalog'),
('b0000000-0000-4000-8000-000000000031', 3, 'catalog');
