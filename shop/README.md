# CGC Darts × MD Studios — Apparel Store

Storefront + admin for **shop.aadsdarts.com**. Lives in this repo as a second Vite entry; shares the wiki's Supabase project.

| Piece | Where |
|---|---|
| Storefront + admin UI (React) | `shop/` (admin at `/admin`) |
| Pricing engine (single source of truth, integer cents) | `supabase/functions/_shared/pricing.js` — imported by the UI as `@pricing` |
| Server logic (checkout, inquiries, private orders, invoices, emails, PDFs) | `supabase/functions/shop-*` + `_shared/` |
| Database (tables, RLS, order transaction, seed) | `supabase/migrations/20261008*_shop_*.sql` |

## Commands

```bash
npm run dev:shop       # local dev at http://localhost:5174
npm run build:shop     # builds to dist-shop/ (Cloudflare Pages runs this on every push to master)
npm run test:pricing   # pricing engine tests (spec §19 examples + replica/shipping rules)
```

## One-time setup

1. **Database:** `supabase db push` (applies the two `20261008*` migrations).
2. **Edge functions:**
   `supabase functions deploy shop-checkout shop-validate-code shop-inquiry shop-private-order shop-track shop-admin`
3. **Email (Resend):** create a Resend account, verify `aadsdarts.com` (add the DNS records Resend shows), then
   `supabase secrets set RESEND_API_KEY=re_xxx`. Until this is set, orders still work and emails are logged as *skipped*.
4. **Admin login:** Supabase dashboard → Authentication → Add user (email + password), then in the SQL editor:
   `insert into shop_admins (user_id, email) select id, email from auth.users where email = 'you@example.com';`
5. **Hosting (Cloudflare Pages, this repo):** Cloudflare dashboard → Workers & Pages → Create → Pages →
   Connect to Git → `dowdarts/aads-war-room`. Build settings: production branch `master`,
   build command `npm run build:shop`, output directory `dist-shop`, root directory `/`,
   environment variable `NODE_VERSION = 22`. Then Custom domains → add `shop.aadsdarts.com`
   (automatic if aadsdarts.com's DNS is on Cloudflare; otherwise add `CNAME shop → <project>.pages.dev`
   at your DNS provider). `shop/public/_redirects` makes deep links like `/admin` and `/custom-order/…` work.
6. **Admin → Settings:** set the shipping charge for 1–2 shirt orders (checkout for fewer than 3 shirts is blocked until set),
   e-Transfer details, and the admin notification email.
7. **Admin → Products → Bulk image upload:** load the collection artwork (`<product-slug>-front.jpg`, `-back.jpg`, `-gallery-1.jpg`).

## Pricing rules (enforced server-side)

- Retail standard shirts: 1–2 → $85, 3–6 → $70 each; zipper +$2, pocket +$2. 7+ → quote.
- Player replicas: always $90, no upgrade charges, count toward the 3-shirt total.
- Shipping: flat rate (Settings) under 3 shirts, free at 3+. Tax rate in Settings (default 0).
- Custom/team: $85 / $75 / $68 / $65 by quantity, options free, $50 design fee once per design
  (mockup + 2 revision rounds), extra 2-round packages $25 each.
- Discount codes: one shirt-price adjustment (percent **or** fixed price) + optional design-fee waiver; redemptions reserved atomically.

## Order → invoice → receipt

New order → admin **Confirm order** (invoice built from the order's locked prices) → Invoice Builder (edit, **Download PDF**,
**Send to customer**) → **Confirm payment received** → at $0 balance the order becomes *Payment Confirmed* and the receipt
(PDF marked PAID) is emailed automatically, exactly once.
