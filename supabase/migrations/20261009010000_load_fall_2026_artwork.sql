-- Fall 2026 artwork for the Legacy, Forged and Elite lines (from the MD Studios
-- design files). Images are served from the shop site itself
-- (shop/public/images/collections); admins can replace any of them from
-- Admin → Products. Only touches products still flagged needs_images and
-- products without variants, so it never overwrites admin edits.

UPDATE public.shop_products SET name = 'Legacy Polo', description = 'Bold diagonal-stripe design with the Cecil’s Garage Championship crest. Available on a black (home) or white (away) base in seven accent colours.', front_image_url = '/images/collections/legacy/legacy-gold-black.webp',
  gallery = '["/images/collections/legacy/legacy-studio.webp"]'::jsonb, needs_images = false, featured = true
WHERE slug = 'legacy-polo' AND needs_images;
INSERT INTO public.shop_product_variants (product_id, colour_name, colour_hex, front_image_url, sort_order)
SELECT p.id, v.name, v.hex, v.img, v.ord
FROM public.shop_products p
CROSS JOIN (VALUES
    ('Gold — Black', '#c9a227', '/images/collections/legacy/legacy-gold-black.webp', 1),
    ('Gold — White', '#c9a227', '/images/collections/legacy/legacy-gold-white.webp', 2),
    ('Blue — Black', '#2563eb', '/images/collections/legacy/legacy-blue-black.webp', 3),
    ('Blue — White', '#2563eb', '/images/collections/legacy/legacy-blue-white.webp', 4),
    ('Green — Black', '#16a34a', '/images/collections/legacy/legacy-green-black.webp', 5),
    ('Green — White', '#16a34a', '/images/collections/legacy/legacy-green-white.webp', 6),
    ('Orange — Black', '#f97316', '/images/collections/legacy/legacy-orange-black.webp', 7),
    ('Orange — White', '#f97316', '/images/collections/legacy/legacy-orange-white.webp', 8),
    ('Pink — Black', '#ec4899', '/images/collections/legacy/legacy-pink-black.webp', 9),
    ('Pink — White', '#ec4899', '/images/collections/legacy/legacy-pink-white.webp', 10),
    ('Purple — Black', '#8b5cf6', '/images/collections/legacy/legacy-purple-black.webp', 11),
    ('Purple — White', '#8b5cf6', '/images/collections/legacy/legacy-purple-white.webp', 12),
    ('Red — Black', '#dc2626', '/images/collections/legacy/legacy-red-black.webp', 13),
    ('Red — White', '#dc2626', '/images/collections/legacy/legacy-red-white.webp', 14)
) AS v(name, hex, img, ord)
WHERE p.slug = 'legacy-polo'
  AND NOT EXISTS (SELECT 1 FROM public.shop_product_variants x WHERE x.product_id = p.id);

UPDATE public.shop_products SET name = 'Forged Polo', description = 'Brushed-metal armour design with the Atlantic Amateur Darts Series front and CGC Darts back. Black base in eight accent colours.', front_image_url = '/images/collections/forged/forged-gold.webp',
  gallery = '["/images/collections/forged/forged-studio.webp", "/images/collections/forged/forged-official.webp"]'::jsonb, needs_images = false, featured = true
WHERE slug = 'forged-polo' AND needs_images;
INSERT INTO public.shop_product_variants (product_id, colour_name, colour_hex, front_image_url, sort_order)
SELECT p.id, v.name, v.hex, v.img, v.ord
FROM public.shop_products p
CROSS JOIN (VALUES
    ('Gold', '#c9a227', '/images/collections/forged/forged-gold.webp', 1),
    ('Blue', '#2563eb', '/images/collections/forged/forged-blue.webp', 2),
    ('Green', '#16a34a', '/images/collections/forged/forged-green.webp', 3),
    ('Grey', '#6b7280', '/images/collections/forged/forged-grey.webp', 4),
    ('Orange', '#f97316', '/images/collections/forged/forged-orange.webp', 5),
    ('Pink', '#ec4899', '/images/collections/forged/forged-pink.webp', 6),
    ('Purple', '#8b5cf6', '/images/collections/forged/forged-purple.webp', 7),
    ('Red', '#dc2626', '/images/collections/forged/forged-red.webp', 8)
) AS v(name, hex, img, ord)
WHERE p.slug = 'forged-polo'
  AND NOT EXISTS (SELECT 1 FROM public.shop_product_variants x WHERE x.product_id = p.id);

UPDATE public.shop_products SET name = 'Elite Polo — Black & Gold', description = 'The flagship Elite design: gold splatter and hex texture on black with the full CGC, AADS and Road to TOC logo set.', front_image_url = '/images/collections/elite/elite-colour-gold.webp',
  gallery = '["/images/collections/elite/elite-official.webp", "/images/collections/elite/elite-black-gold-alt.webp"]'::jsonb, needs_images = false, featured = true
WHERE slug = 'elite-polo' AND needs_images;

UPDATE public.shop_products SET name = 'Elite Colour Polo', description = 'The Elite splatter design on a black base, in eight accent colours.', front_image_url = '/images/collections/elite/elite-colour-blue.webp',
  gallery = '[]'::jsonb, needs_images = false, featured = true
WHERE slug = 'elite-colour-polo' AND needs_images;
INSERT INTO public.shop_product_variants (product_id, colour_name, colour_hex, front_image_url, sort_order)
SELECT p.id, v.name, v.hex, v.img, v.ord
FROM public.shop_products p
CROSS JOIN (VALUES
    ('Gold', '#c9a227', '/images/collections/elite/elite-colour-gold.webp', 1),
    ('Blue', '#2563eb', '/images/collections/elite/elite-colour-blue.webp', 2),
    ('Green', '#16a34a', '/images/collections/elite/elite-colour-green.webp', 3),
    ('Orange', '#f97316', '/images/collections/elite/elite-colour-orange.webp', 4),
    ('Pink', '#ec4899', '/images/collections/elite/elite-colour-pink.webp', 5),
    ('Purple', '#8b5cf6', '/images/collections/elite/elite-colour-purple.webp', 6),
    ('Red', '#dc2626', '/images/collections/elite/elite-colour-red.webp', 7),
    ('Silver', '#c0c0c0', '/images/collections/elite/elite-colour-silver.webp', 8)
) AS v(name, hex, img, ord)
WHERE p.slug = 'elite-colour-polo'
  AND NOT EXISTS (SELECT 1 FROM public.shop_product_variants x WHERE x.product_id = p.id);

UPDATE public.shop_products SET name = 'Elite White Polo — Home & Away', description = 'The Elite splatter design fading from black to a white base, in eight accent colours.', front_image_url = '/images/collections/elite/elite-white-gold.webp',
  gallery = '[]'::jsonb, needs_images = false, featured = true
WHERE slug = 'elite-white-polo' AND needs_images;
INSERT INTO public.shop_product_variants (product_id, colour_name, colour_hex, front_image_url, sort_order)
SELECT p.id, v.name, v.hex, v.img, v.ord
FROM public.shop_products p
CROSS JOIN (VALUES
    ('Gold', '#c9a227', '/images/collections/elite/elite-white-gold.webp', 1),
    ('Blue', '#2563eb', '/images/collections/elite/elite-white-blue.webp', 2),
    ('Green', '#16a34a', '/images/collections/elite/elite-white-green.webp', 3),
    ('Orange', '#f97316', '/images/collections/elite/elite-white-orange.webp', 4),
    ('Pink', '#ec4899', '/images/collections/elite/elite-white-pink.webp', 5),
    ('Purple', '#8b5cf6', '/images/collections/elite/elite-white-purple.webp', 6),
    ('Red', '#dc2626', '/images/collections/elite/elite-white-red.webp', 7),
    ('Silver', '#c0c0c0', '/images/collections/elite/elite-white-silver.webp', 8)
) AS v(name, hex, img, ord)
WHERE p.slug = 'elite-white-polo'
  AND NOT EXISTS (SELECT 1 FROM public.shop_product_variants x WHERE x.product_id = p.id);
