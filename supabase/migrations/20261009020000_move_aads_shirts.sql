-- The colour polo and every shirt with "AADS" in its name belong in the AADS
-- collection, not Vintage CGC. The colour polo is the AADS colour polo.
-- The AADS placeholder product is hidden now that the collection has real shirts.

UPDATE public.shop_products
SET collection_id = (SELECT id FROM public.shop_collections WHERE slug = 'aads')
WHERE slug IN ('cgc-colour-polo', 'aads-fan-jersey', 'aads-commentary-duo-shirt', 'aads-ricky-chaisson-player-replica-shirt')
   OR (name ILIKE '%aads%' AND collection_id = (SELECT id FROM public.shop_collections WHERE slug = 'vintage-cgc'));

UPDATE public.shop_products
SET name = 'AADS Colour Polo', slug = 'aads-colour-polo', description = 'Classic AADS polo — pick your colour.'
WHERE slug = 'cgc-colour-polo'
  AND NOT EXISTS (SELECT 1 FROM public.shop_products WHERE slug = 'aads-colour-polo');

UPDATE public.shop_products SET status = 'inactive'
WHERE slug = 'aads-polo' AND needs_images;

UPDATE public.shop_collections SET description = 'Official AADS apparel — the Atlantic Amateur Darts Series.'
WHERE slug = 'aads' AND description = 'Official AADS apparel.';
