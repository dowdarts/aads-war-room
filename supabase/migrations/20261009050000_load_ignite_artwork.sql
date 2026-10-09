-- Ignite artwork (MD Studios "Ignite Concept Collection"). Orange uses the
-- full-size mockup; the other nine colours are cropped from the collection
-- poster until full-size mockups exist (replace them in Admin → Products).
UPDATE public.shop_products SET name = 'Ignite Polo',
  description = 'Built for competition. Glowing light-streak design on a black hex base, with the Atlantic Amateur Darts Series and CGC Darts on the back. Ten colours.',
  front_image_url = '/images/collections/ignite/ignite-orange-full.webp',
  gallery = '["/images/collections/ignite/ignite-studio.webp", "/images/collections/ignite/ignite-collection.webp"]'::jsonb, needs_images = false, featured = true
WHERE slug = 'ignite-polo' AND needs_images;

INSERT INTO public.shop_product_variants (product_id, colour_name, colour_hex, front_image_url, sort_order)
SELECT p.id, v.name, v.hex, v.img, v.ord
FROM public.shop_products p
CROSS JOIN (VALUES
    ('Orange', '#f97316', '/images/collections/ignite/ignite-orange-full.webp', 1),
    ('Red', '#dc2626', '/images/collections/ignite/ignite-red.webp', 2),
    ('Gold', '#c9a227', '/images/collections/ignite/ignite-gold.webp', 3),
    ('Emerald', '#10b981', '/images/collections/ignite/ignite-emerald.webp', 4),
    ('Sapphire', '#2563eb', '/images/collections/ignite/ignite-sapphire.webp', 5),
    ('Purple', '#8b5cf6', '/images/collections/ignite/ignite-purple.webp', 6),
    ('Pink', '#ec4899', '/images/collections/ignite/ignite-pink.webp', 7),
    ('Ice', '#67e8f9', '/images/collections/ignite/ignite-ice.webp', 8),
    ('Silver', '#c0c0c0', '/images/collections/ignite/ignite-silver.webp', 9),
    ('Copper', '#b87333', '/images/collections/ignite/ignite-copper.webp', 10)
) AS v(name, hex, img, ord)
WHERE p.slug = 'ignite-polo'
  AND NOT EXISTS (SELECT 1 FROM public.shop_product_variants x WHERE x.product_id = p.id);
