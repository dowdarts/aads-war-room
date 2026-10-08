-- Seed data for the apparel store: default settings, the Fall 2026 collection
-- tree, placeholder products for the new lines (admin uploads real artwork
-- later; needs_images = true flags them), and the Vintage CGC collection
-- carried over from the old public/shirt-order.html catalog.
-- Idempotent: safe to re-run; never overwrites admin edits.

INSERT INTO public.shop_settings (key, value, is_public, description) VALUES
  ('business_name',          '"CGC Darts × MD Studios"', true,  'Shown in header, emails, invoices'),
  ('contact_email',          '"dow1800@gmail.com"',      true,  'Public contact address'),
  ('etransfer_email',        '"dow1800@gmail.com"',      true,  'Interac e-Transfer recipient'),
  ('etransfer_instructions', '"Send an Interac e-Transfer for the amount due to the address above. Put your order or invoice number in the message field. Your order is not confirmed until the transfer is received and verified."', true, 'Payment instructions shown at checkout and on invoices'),
  ('shipping_cents',         'null',                     true,  'Flat retail shipping charged when fewer than free_shipping_min_qty shirts. Checkout for 1–2 shirts is blocked until set.'),
  ('free_shipping_min_qty',  '3',                        true,  'Retail orders with at least this many shirts ship free'),
  ('custom_shipping_cents',  '0',                        true,  'Flat shipping added to custom/team orders'),
  ('tax_rate_percent',       '0',                        true,  'Tax percentage applied to totals (0 = no tax)'),
  ('retail_quote_message',   '"Ordering more than 6 shirts? Contact us for a team quote — larger retail orders are arranged directly."', true, 'Shown when a retail cart exceeds 6 shirts'),
  ('admin_notify_email',     '"dow1800@gmail.com"',      false, 'Where admin notifications are sent'),
  ('email_from',             '"CGC Darts <orders@aadsdarts.com>"', false, 'Sender identity for all store emails'),
  ('shop_url',               '"https://shop.aadsdarts.com"', true, 'Public store URL used in emails and links'),
  ('logo_url',               'null',                     true,  'Header logo image (empty = CGC text logo)')
ON CONFLICT (key) DO NOTHING;

-- Collection tree
INSERT INTO public.shop_collections (slug, name, description, sort_order, featured) VALUES
  ('elite',       'Elite',       'The flagship CGC Elite line — Fall 2026.', 10, true),
  ('legacy',      'Legacy',      'Fall 2026 Legacy collection.',             20, true),
  ('ignite',      'Ignite',      'Fall 2026 Ignite collection.',             30, true),
  ('forged',      'Forged',      'Fall 2026 Forged collection.',             40, true),
  ('aads',        'AADS',        'Official AADS apparel.',                   50, false),
  ('vintage-cgc', 'Vintage CGC', 'Classic CGC designs and player replica shirts.', 60, false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.shop_collections (slug, name, description, sort_order, parent_id)
SELECT v.slug, v.name, v.description, v.sort_order, (SELECT id FROM public.shop_collections WHERE slug = 'elite')
FROM (VALUES
  ('elite-white',  'Elite White',  'Elite in white.',          11),
  ('elite-colour', 'Elite Colour', 'Elite in bold colourways.', 12)
) AS v(slug, name, description, sort_order)
ON CONFLICT (slug) DO NOTHING;

-- Placeholder products for the new lines (replace art + details in admin)
INSERT INTO public.shop_products (collection_id, slug, name, description, price_class, personalization, featured, sort_order, needs_images)
SELECT c.id, v.slug, v.name, v.description, 'standard', 'custom', true, 10, true
FROM (VALUES
  ('elite',        'elite-polo',        'Elite Polo',        'CGC Elite performance polo.'),
  ('elite-white',  'elite-white-polo',  'Elite White Polo',  'CGC Elite polo in white.'),
  ('elite-colour', 'elite-colour-polo', 'Elite Colour Polo', 'CGC Elite polo in colour.'),
  ('legacy',       'legacy-polo',       'Legacy Polo',       'CGC Legacy polo.'),
  ('ignite',       'ignite-polo',       'Ignite Polo',       'CGC Ignite polo.'),
  ('forged',       'forged-polo',       'Forged Polo',       'CGC Forged polo.'),
  ('aads',         'aads-polo',         'AADS Polo',         'Official AADS polo.')
) AS v(collection_slug, slug, name, description)
JOIN public.shop_collections c ON c.slug = v.collection_slug
ON CONFLICT (slug) DO NOTHING;

-- Vintage CGC: the 20 shirts from the previous catalog (replicas keep their locked names)
INSERT INTO public.shop_products (collection_id, slug, name, price_class, personalization, locked_name, front_image_url, sort_order, needs_images)
SELECT (SELECT id FROM public.shop_collections WHERE slug = 'vintage-cgc'), v.slug, v.name, v.price_class, v.personalization, v.locked_name, v.img, v.sort_order, false
FROM (VALUES
  ('score-keeper-and-official-shirt', 'Score Keeper & Official Shirt', 'standard', 'custom', NULL, 'https://maxcorners.us/cdn/shop/files/MT16062026-MC-PL1-KH_dba2ec25-b8f6-443c-b954-1cc77c55b745.jpg?v=1781599813&width=1946', 10),
  ('cgc-blue-female-camo', 'CGC Blue Female Camo', 'standard', 'custom', NULL, 'https://maxcorners.us/cdn/shop/files/LM26102024-DT-PL10-KH_3.jpg?v=1733741818', 20),
  ('rhyder-event-5-finalist-player-shirt', 'Rhyder Event 5 Finalist Player Shirt', 'replica', 'locked', 'Rhyder Oliver', 'https://maxcorners.us/cdn/shop/files/LM25062024MC-PL77-CYAN-KH_1.jpg?v=1776324369&width=713', 30),
  ('tammy-walsh-cgc-shirt', 'Tammy Walsh CGC Shirt', 'replica', 'locked', 'Tammy Walsh', 'https://maxcorners.us/cdn/shop/files/MT18072025MC-DS-PL3-Pink-KH.jpg?v=1776314848&width=713', 40),
  ('aads-fan-jersey', 'AADS Fan Jersey', 'standard', 'custom', NULL, 'https://maxcorners.us/cdn/shop/files/TU11082025MC-PL3-Orange-KH.jpg?v=1759463577&width=713', 50),
  ('rob-sibbick-event-6-champion-player-replica-shirt', 'Rob Sibbick Event 6 Champion Player Replica Shirt', 'replica', 'locked', 'Rob Sibbick', 'https://maxcorners.us/cdn/shop/files/LM05152026MC-PL10-Blue-KH.jpg?v=1778837458&width=713', 60),
  ('drake-berry-event-5-champion-player-replica-shirt', 'Drake Berry Event 5 Champion Player Replica Shirt', 'replica', 'locked', 'Drake Berry', 'https://maxcorners.us/cdn/shop/files/LM25022025MC-CAO-PL02-Blue-KH.jpg?v=1775634592&width=713', 70),
  ('kayla-melanson-player-replica-shirt', 'Kayla Melanson Player Replica Shirt', 'replica', 'locked', 'Kayla Melanson', 'https://maxcorners.us/cdn/shop/files/1709.jpg?v=1759287978&width=713', 80),
  ('tyler-stewart-cgc-player-replica-shirt', 'Tyler Stewart CGC Player Replica Shirt', 'replica', 'locked', 'Tyler Stewart', 'https://maxcorners.us/cdn/shop/files/LM14825MC-PL07-FCZ-Orange-KH.jpg?v=1758536785&width=713', 90),
  ('tyler-cyr-event-3-champion-player-replica-jersey', 'Tyler Cyr Event 3 Champion Player Replica Jersey', 'replica', 'locked', 'Tyler Cyr', 'https://maxcorners.us/cdn/shop/files/TU19062025MC-PL1-KH.jpg?v=1760410684&width=713', 100),
  ('tom-holden-event-1-champion-player-replica-shirt', 'Tom Holden Event 1 Champion Player Replica Shirt', 'replica', 'locked', 'Tom Holden', 'https://maxcorners.us/cdn/shop/files/LM12052025MC-PL46-BLUE-KH.jpg?v=1756974935&width=713', 110),
  ('cgc-classic-white-shirt', 'CGC Classic White Shirt', 'standard', 'custom', NULL, 'https://maxcorners.us/cdn/shop/files/MT12112024MC-DAR-DT-PL1-KH_1.jpg?v=1733741942&width=713', 120),
  ('aads-commentary-duo-shirt', 'AADS Commentary Duo Shirt', 'standard', 'custom', NULL, 'https://maxcorners.us/cdn/shop/files/LM25925MC-MK-PL12-WHITE-KH.jpg?v=1770864082&width=713', 130),
  ('denis-cormier-player-replica-shirt', 'Denis Cormier Player Replica Shirt', 'replica', 'locked', 'Denis Cormier', 'https://maxcorners.us/cdn/shop/files/LM040925MC-PL3-FCZ-Green-KH-1.jpg?v=1760327313&width=713', 140),
  ('cgc-gold-jersey', 'CGC Gold Jersey', 'standard', 'custom', NULL, 'https://maxcorners.us/cdn/shop/files/DT29032024MC-PL2-Gold-KH1_1.jpg?v=1741079399&width=713', 150),
  ('event-4-champion-dee-cormier-replica-shirt', 'Event 4 Champion Dee Cormier Replica Shirt', 'replica', 'locked', 'Dee Cormier', 'https://maxcorners.us/cdn/shop/files/MT18122024MC-DT-PL4-Dar-Gold-KH.jpg?v=1773804554&width=713', 160),
  ('aads-ricky-chaisson-player-replica-shirt', 'AADS Ricky Chaisson Player Replica Shirt', 'replica', 'locked', 'Ricky Chaisson', 'https://maxcorners.us/cdn/shop/files/MT15052025MC-CAO-PL1-KH.jpg?v=1759462241&width=713', 170),
  ('kyle-gray-event-2-champion-player-replica-shirt', 'Kyle Gray Event 2 Champion Player Replica Shirt', 'replica', 'locked', 'Kyle Gray', 'https://maxcorners.us/cdn/shop/files/0504_72e312b3-5fbe-4e51-8553-fb07d1b5fbc6.jpg?v=1757393067&width=713', 180),
  ('cgc-breast-cancer-awareness-shirt', 'CGC Breast Cancer Awareness Shirt', 'standard', 'custom', NULL, 'https://maxcorners.us/cdn/shop/files/LM060425MC-CAO-PL10-KH.jpg?v=1762137646&width=713', 190),
  ('cgc-white-and-grey-shirt', 'CGC White and Grey Shirt', 'standard', 'custom', NULL, 'https://maxcorners.us/cdn/shop/files/MT29092024MC-DT-PL90-KH1.jpg?v=1741079113&width=713', 200)
) AS v(slug, name, price_class, personalization, locked_name, img, sort_order)
ON CONFLICT (slug) DO NOTHING;

-- Vintage CGC Colour Polo (previous build-your-own polo) with its 5 colourways
INSERT INTO public.shop_products (collection_id, slug, name, description, price_class, personalization, front_image_url, sort_order, needs_images)
SELECT id, 'cgc-colour-polo', 'CGC Colour Polo', 'Classic CGC polo — pick your colour.', 'standard', 'custom',
       'https://wiki.aadsdarts.com/images/shirts/shirt-red.png', 5, false
FROM public.shop_collections WHERE slug = 'vintage-cgc'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.shop_product_variants (product_id, colour_name, colour_hex, front_image_url, sort_order)
SELECT p.id, v.name, v.hex, 'https://wiki.aadsdarts.com/images/shirts/shirt-' || lower(v.name) || '.png', v.sort_order
FROM public.shop_products p
CROSS JOIN (VALUES ('Red', '#e63b3b', 1), ('Blue', '#3b7fe6', 2), ('Green', '#2da85a', 3), ('Purple', '#9b3be6', 4), ('Orange', '#ff7a00', 5)) AS v(name, hex, sort_order)
WHERE p.slug = 'cgc-colour-polo'
  AND NOT EXISTS (SELECT 1 FROM public.shop_product_variants x WHERE x.product_id = p.id);
