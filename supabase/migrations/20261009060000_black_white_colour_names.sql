-- Colour options for Legacy, Elite and Ignite are named "Black & <colour>" /
-- "White & <colour>" (base & accent), and each line is a single product in
-- its own collection so everything filters under Legacy / Elite / Ignite.

-- Legacy: "Gold — Black" → "Black & Gold", "Gold — White" → "White & Gold"
UPDATE public.shop_product_variants v
SET colour_name = initcap(split_part(v.colour_name, ' — ', 2)) || ' & ' || split_part(v.colour_name, ' — ', 1)
FROM public.shop_products p
WHERE v.product_id = p.id AND p.slug = 'legacy-polo' AND v.colour_name LIKE '% — %';

-- Ignite: black base only → "Black & Orange", …
UPDATE public.shop_product_variants v
SET colour_name = 'Black & ' || v.colour_name
FROM public.shop_products p
WHERE v.product_id = p.id AND p.slug = 'ignite-polo' AND v.colour_name NOT LIKE '% & %';

-- Elite: merge the black-base and white-base shirts into one Elite Polo
UPDATE public.shop_products SET name = 'Elite Polo',
  description = 'Gold-splatter and hex-texture design with the full CGC, AADS and Road to TOC logo set. Black or white base in eight accent colours.'
WHERE slug = 'elite-polo';

INSERT INTO public.shop_product_variants (product_id, colour_name, colour_hex, front_image_url, sort_order)
SELECT p.id, v.name, v.hex, v.img, v.ord
FROM public.shop_products p
CROSS JOIN (VALUES
    ('Black & Gold', '#c9a227', '/images/collections/elite/elite-colour-gold.webp', 1),
    ('White & Gold', '#c9a227', '/images/collections/elite/elite-white-gold.webp', 2),
    ('Black & Blue', '#2563eb', '/images/collections/elite/elite-colour-blue.webp', 3),
    ('White & Blue', '#2563eb', '/images/collections/elite/elite-white-blue.webp', 4),
    ('Black & Green', '#16a34a', '/images/collections/elite/elite-colour-green.webp', 5),
    ('White & Green', '#16a34a', '/images/collections/elite/elite-white-green.webp', 6),
    ('Black & Orange', '#f97316', '/images/collections/elite/elite-colour-orange.webp', 7),
    ('White & Orange', '#f97316', '/images/collections/elite/elite-white-orange.webp', 8),
    ('Black & Pink', '#ec4899', '/images/collections/elite/elite-colour-pink.webp', 9),
    ('White & Pink', '#ec4899', '/images/collections/elite/elite-white-pink.webp', 10),
    ('Black & Purple', '#8b5cf6', '/images/collections/elite/elite-colour-purple.webp', 11),
    ('White & Purple', '#8b5cf6', '/images/collections/elite/elite-white-purple.webp', 12),
    ('Black & Red', '#dc2626', '/images/collections/elite/elite-colour-red.webp', 13),
    ('White & Red', '#dc2626', '/images/collections/elite/elite-white-red.webp', 14),
    ('Black & Silver', '#c0c0c0', '/images/collections/elite/elite-colour-silver.webp', 15),
    ('White & Silver', '#c0c0c0', '/images/collections/elite/elite-white-silver.webp', 16)
) AS v(name, hex, img, ord)
WHERE p.slug = 'elite-polo'
  AND NOT EXISTS (SELECT 1 FROM public.shop_product_variants x WHERE x.product_id = p.id);

UPDATE public.shop_products SET status = 'inactive' WHERE slug IN ('elite-colour-polo', 'elite-white-polo');
UPDATE public.shop_collections SET visible = false WHERE slug IN ('elite-colour', 'elite-white');
