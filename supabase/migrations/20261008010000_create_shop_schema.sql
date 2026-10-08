-- CGC Darts × MD Studios apparel store (shop.aadsdarts.com).
--
-- Unlike the rest of this project (anon key + permissive RLS), the shop holds
-- customer PII, invoices and payments, so it uses real Supabase Auth for
-- admins and locks everything down:
--   * anon may only SELECT visible collections, active products/variants and
--     public settings;
--   * authenticated users in shop_admins get full access via shop_is_admin();
--   * every customer-facing write (checkout, inquiry, private order) goes
--     through shop-* edge functions using the service role, which re-price
--     with supabase/functions/_shared/pricing.js before calling the
--     SECURITY DEFINER functions below.
-- All money is integer cents.

-- ── Admins ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.shop_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_admins WHERE user_id = auth.uid())
$$;

-- ── Settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_settings (
  key text PRIMARY KEY,
  value jsonb,
  is_public boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Customers ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  team text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_customers_email_uidx ON public.shop_customers (lower(email));

-- ── Catalogue ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.shop_collections(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES public.shop_collections(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'polo',
  style_keywords text,
  price_class text NOT NULL DEFAULT 'standard' CHECK (price_class IN ('standard', 'replica')),
  personalization text NOT NULL DEFAULT 'custom' CHECK (personalization IN ('none', 'custom', 'locked')),
  locked_name text,
  sizes text[] NOT NULL DEFAULT ARRAY['S','M','L','XL','2XL','3XL','4XL','5XL'],
  front_image_url text,
  back_image_url text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  needs_images boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_products_collection_idx ON public.shop_products (collection_id);

CREATE TABLE IF NOT EXISTS public.shop_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  colour_name text NOT NULL,
  colour_hex text,
  front_image_url text,
  back_image_url text,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_variants_product_idx ON public.shop_product_variants (product_id);

-- ── Custom design inquiries / projects ──────────────────
CREATE TABLE IF NOT EXISTS public.shop_design_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.shop_customers(id),
  estimated_qty integer NOT NULL CHECK (estimated_qty > 0),
  brief text NOT NULL,
  team text,
  colour_palette text,
  style_notes text,
  sponsor_notes text,
  player_names_notes text,
  instructions text,
  estimate_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_design_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number text NOT NULL UNIQUE,
  inquiry_id uuid REFERENCES public.shop_design_inquiries(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.shop_customers(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'new_inquiry' CHECK (status IN (
    'new_inquiry','under_review','quote_sent','awaiting_design_payment','mockup_in_progress',
    'initial_mockup_sent','awaiting_feedback','revision_requested','revised_mockup_sent',
    'design_approved','private_link_created','final_order_submitted','awaiting_balance',
    'in_production','shipped','completed','on_hold','cancelled')),
  invoice_status text NOT NULL DEFAULT 'none' CHECK (invoice_status IN ('none','quoted','invoiced','partial','paid')),
  estimated_qty integer,
  locked_unit_cents integer CHECK (locked_unit_cents IS NULL OR locked_unit_cents >= 0),
  revisions_used integer NOT NULL DEFAULT 0 CHECK (revisions_used >= 0),
  extra_packages_approved integer NOT NULL DEFAULT 0 CHECK (extra_packages_approved >= 0),
  design_fee_waived boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approval_note text,
  approved_front_file_id uuid,
  approved_back_file_id uuid,
  public_description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_design_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.shop_design_projects(id) ON DELETE CASCADE,
  inquiry_id uuid REFERENCES public.shop_design_inquiries(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('customer_upload','mockup','final_front','final_back','other')),
  version integer,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  storage_path text NOT NULL,
  sent_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_revision_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.shop_design_projects(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('mockup_sent','revision_requested','revised_mockup_sent','package_approved','approved','note')),
  round integer,
  detail text,
  file_id uuid REFERENCES public.shop_design_files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_private_order_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.shop_design_projects(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.shop_customers(id),
  token_hash text NOT NULL UNIQUE,
  token_hint text NOT NULL,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Discounts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  label text,
  description text,
  kind text CHECK (kind IN ('percent', 'fixed')),
  percent numeric(5,2) CHECK (percent IS NULL OR (percent > 0 AND percent <= 100)),
  fixed_unit_cents integer CHECK (fixed_unit_cents IS NULL OR fixed_unit_cents >= 0),
  waive_design_fee boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'any' CHECK (channel IN ('any', 'RETAIL', 'CUSTOM')),
  product_ids uuid[] NOT NULL DEFAULT '{}',
  collection_ids uuid[] NOT NULL DEFAULT '{}',
  customer_id uuid REFERENCES public.shop_customers(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.shop_design_projects(id) ON DELETE SET NULL,
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  max_per_customer integer CHECK (max_per_customer IS NULL OR max_per_customer > 0),
  min_qty integer,
  max_qty integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  redemption_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One shirt-price adjustment at most, plus optional fee waiver.
  CONSTRAINT shop_discount_one_adjustment CHECK (
    (kind IS NULL AND percent IS NULL AND fixed_unit_cents IS NULL)
    OR (kind = 'percent' AND percent IS NOT NULL AND fixed_unit_cents IS NULL)
    OR (kind = 'fixed' AND fixed_unit_cents IS NOT NULL AND percent IS NULL)),
  CONSTRAINT shop_discount_does_something CHECK (kind IS NOT NULL OR waive_design_fee)
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_discount_codes_code_uidx ON public.shop_discount_codes (upper(code));

-- ── Orders ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  order_type text NOT NULL CHECK (order_type IN ('RETAIL', 'CUSTOM')),
  customer_id uuid NOT NULL REFERENCES public.shop_customers(id),
  project_id uuid REFERENCES public.shop_design_projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new','awaiting_payment','payment_confirmed','awaiting_production','in_production',
    'production_complete','shipped','delivered','completed','cancelled')),
  payment_status text NOT NULL DEFAULT 'awaiting' CHECK (payment_status IN (
    'awaiting','partial','received_unverified','verified','refunded')),
  idempotency_key text NOT NULL UNIQUE,
  lookup_token_hash text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  ship_street text,
  ship_city text,
  ship_province text,
  ship_postal text,
  ship_country text,
  instructions text,
  discount_code_id uuid REFERENCES public.shop_discount_codes(id) ON DELETE SET NULL,
  discount_code text,
  pricing_snapshot jsonb NOT NULL,
  subtotal_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  design_fee_cents integer NOT NULL DEFAULT 0,
  shipping_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  customer_reported_paid_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_orders_customer_idx ON public.shop_orders (customer_id);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON public.shop_orders (status);

ALTER TABLE public.shop_private_order_links
  DROP CONSTRAINT IF EXISTS shop_private_order_links_order_fk,
  ADD CONSTRAINT shop_private_order_links_order_fk FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.shop_product_variants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  collection_name text,
  colour text,
  size text NOT NULL,
  closure text NOT NULL CHECK (closure IN ('button', 'zipper')),
  pocket boolean NOT NULL DEFAULT false,
  personalization text,
  price_class text NOT NULL DEFAULT 'standard',
  qty integer NOT NULL CHECK (qty > 0),
  base_unit_cents integer NOT NULL,
  zipper_unit_cents integer NOT NULL DEFAULT 0,
  pocket_unit_cents integer NOT NULL DEFAULT 0,
  unit_cents integer NOT NULL,
  line_cents integer NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON public.shop_order_items (order_id);

CREATE TABLE IF NOT EXISTS public.shop_discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.shop_discount_codes(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.shop_customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  savings_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Invoices / payments / shipments ─────────────────────
CREATE TABLE IF NOT EXISTS public.shop_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'invoice' CHECK (kind IN ('quote', 'invoice', 'receipt')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'superseded', 'void')),
  order_id uuid REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.shop_design_projects(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.shop_customers(id),
  snapshot jsonb NOT NULL,
  subtotal_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  shipping_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  credits_cents integer NOT NULL DEFAULT 0,
  balance_cents integer NOT NULL,
  notes text,
  pdf_path text,
  source_invoice_number text,
  issued_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_number, version)
);
CREATE INDEX IF NOT EXISTS shop_invoices_order_idx ON public.shop_invoices (order_id);
CREATE INDEX IF NOT EXISTS shop_invoices_project_idx ON public.shop_invoices (project_id);
-- Only one receipt per paid invoice, ever (prevents duplicate receipts on double-click).
CREATE UNIQUE INDEX IF NOT EXISTS shop_invoices_one_receipt_uidx ON public.shop_invoices (source_invoice_number) WHERE kind = 'receipt';

CREATE TABLE IF NOT EXISTS public.shop_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.shop_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_cents integer NOT NULL,
  line_cents integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.shop_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.shop_orders(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.shop_design_projects(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.shop_invoices(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  method text NOT NULL DEFAULT 'interac',
  reference text,
  received_on date,
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('unverified', 'verified', 'refunded', 'void')),
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_payment_target CHECK (order_id IS NOT NULL OR project_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.shop_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  carrier text,
  tracking_number text,
  tracking_url text,
  dispatched_on date,
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'shipped', 'delivered', 'returned')),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  order_id uuid REFERENCES public.shop_orders(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.shop_design_projects(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.shop_invoices(id) ON DELETE SET NULL,
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider_id text,
  error text,
  payload jsonb,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.shop_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor uuid,
  actor_label text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_rate_limits (
  bucket text NOT NULL,
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key_hash, window_start)
);

CREATE TABLE IF NOT EXISTS public.shop_counters (
  prefix text NOT NULL,
  year integer NOT NULL,
  value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);

-- ── Helpers ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shop_customers','shop_collections','shop_products','shop_design_projects','shop_discount_codes','shop_orders']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_touch ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.shop_touch_updated_at()', t);
  END LOOP;
END $$;

-- ORD-2026-00001 / INV-2026-00001 / PRJ-2026-0001 / INQ-2026-0001
CREATE OR REPLACE FUNCTION public.shop_next_number(p_prefix text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y integer := extract(year FROM now() AT TIME ZONE 'America/Halifax');
DECLARE v integer;
BEGIN
  INSERT INTO shop_counters (prefix, year, value) VALUES (p_prefix, y, 1)
  ON CONFLICT (prefix, year) DO UPDATE SET value = shop_counters.value + 1
  RETURNING value INTO v;
  RETURN p_prefix || '-' || y || '-' || lpad(v::text, 5, '0');
END $$;

-- Fixed-window rate limiter; returns true when the request is allowed.
CREATE OR REPLACE FUNCTION public.shop_rate_limit_hit(p_bucket text, p_key_hash text, p_window_seconds integer, p_max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
DECLARE n integer;
BEGIN
  DELETE FROM shop_rate_limits WHERE window_start < now() - interval '1 day';
  INSERT INTO shop_rate_limits (bucket, key_hash, window_start, hits) VALUES (p_bucket, p_key_hash, ws, 1)
  ON CONFLICT (bucket, key_hash, window_start) DO UPDATE SET hits = shop_rate_limits.hits + 1
  RETURNING hits INTO n;
  RETURN n <= p_max;
END $$;

-- Atomically reserve a discount redemption: locks the code row, re-checks
-- status/window/limits, then records the redemption. Raises on failure so the
-- caller's whole order transaction rolls back.
CREATE OR REPLACE FUNCTION public.shop_reserve_discount(p_code_id uuid, p_customer_id uuid, p_order_id uuid, p_savings_cents integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c shop_discount_codes%ROWTYPE;
DECLARE used_by_customer integer;
BEGIN
  SELECT * INTO c FROM shop_discount_codes WHERE id = p_code_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'active' THEN RAISE EXCEPTION 'DISCOUNT_INVALID'; END IF;
  IF c.starts_at IS NOT NULL AND now() < c.starts_at THEN RAISE EXCEPTION 'DISCOUNT_NOT_STARTED'; END IF;
  IF c.expires_at IS NOT NULL AND now() > c.expires_at THEN RAISE EXCEPTION 'DISCOUNT_EXPIRED'; END IF;
  IF c.customer_id IS NOT NULL AND c.customer_id <> p_customer_id THEN RAISE EXCEPTION 'DISCOUNT_RESTRICTED'; END IF;
  IF c.max_redemptions IS NOT NULL AND c.redemption_count >= c.max_redemptions THEN RAISE EXCEPTION 'DISCOUNT_USED_UP'; END IF;
  IF c.max_per_customer IS NOT NULL THEN
    SELECT count(*) INTO used_by_customer FROM shop_discount_redemptions WHERE code_id = p_code_id AND customer_id = p_customer_id;
    IF used_by_customer >= c.max_per_customer THEN RAISE EXCEPTION 'DISCOUNT_CUSTOMER_LIMIT'; END IF;
  END IF;
  INSERT INTO shop_discount_redemptions (code_id, customer_id, order_id, savings_cents) VALUES (p_code_id, p_customer_id, p_order_id, p_savings_cents);
  UPDATE shop_discount_codes SET redemption_count = redemption_count + 1 WHERE id = p_code_id;
END $$;

-- Upsert customer by email (case-insensitive); returns id.
CREATE OR REPLACE FUNCTION public.shop_upsert_customer(p_name text, p_email text, p_phone text, p_team text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  SELECT id INTO cid FROM shop_customers WHERE lower(email) = lower(trim(p_email));
  IF cid IS NULL THEN
    INSERT INTO shop_customers (name, email, phone, team) VALUES (trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), nullif(trim(p_team), ''))
    RETURNING id INTO cid;
  ELSE
    UPDATE shop_customers SET
      name = coalesce(nullif(trim(p_name), ''), name),
      phone = coalesce(nullif(trim(p_phone), ''), phone),
      team = coalesce(nullif(trim(p_team), ''), team)
    WHERE id = cid;
  END IF;
  RETURN cid;
END $$;

-- Create an order + items (+ discount redemption, + private link consumption)
-- in one transaction. Idempotent on idempotency_key: a repeated submit returns
-- the existing order instead of creating a duplicate.
CREATE OR REPLACE FUNCTION public.shop_create_order(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing shop_orders%ROWTYPE;
DECLARE cid uuid;
DECLARE oid uuid;
DECLARE onum text;
DECLARE item jsonb;
DECLARE i integer := 0;
DECLARE link shop_private_order_links%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM shop_orders WHERE idempotency_key = p->>'idempotency_key';
  IF FOUND THEN
    RETURN jsonb_build_object('order_id', existing.id, 'order_number', existing.order_number, 'duplicate', true, 'total_cents', existing.total_cents);
  END IF;

  IF p ? 'private_link_id' AND p->>'private_link_id' IS NOT NULL THEN
    SELECT * INTO link FROM shop_private_order_links WHERE id = (p->>'private_link_id')::uuid FOR UPDATE;
    IF NOT FOUND OR link.revoked OR link.used_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
      RAISE EXCEPTION 'LINK_INVALID';
    END IF;
  END IF;

  cid := shop_upsert_customer(p->>'contact_name', p->>'contact_email', p->>'contact_phone', p->>'team');
  onum := shop_next_number('ORD');

  INSERT INTO shop_orders (
    order_number, order_type, customer_id, project_id, idempotency_key, lookup_token_hash,
    contact_name, contact_email, contact_phone, ship_street, ship_city, ship_province, ship_postal, ship_country,
    instructions, discount_code_id, discount_code, pricing_snapshot,
    subtotal_cents, discount_cents, design_fee_cents, shipping_cents, tax_cents, total_cents
  ) VALUES (
    onum, p->>'order_type', cid, nullif(p->>'project_id', '')::uuid, p->>'idempotency_key', p->>'lookup_token_hash',
    trim(p->>'contact_name'), lower(trim(p->>'contact_email')), p->>'contact_phone',
    p->>'ship_street', p->>'ship_city', p->>'ship_province', p->>'ship_postal', p->>'ship_country',
    p->>'instructions', nullif(p->>'discount_code_id', '')::uuid, p->>'discount_code', p->'pricing_snapshot',
    (p->>'subtotal_cents')::int, (p->>'discount_cents')::int, coalesce((p->>'design_fee_cents')::int, 0),
    (p->>'shipping_cents')::int, (p->>'tax_cents')::int, (p->>'total_cents')::int
  ) RETURNING id INTO oid;

  FOR item IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
    INSERT INTO shop_order_items (
      order_id, product_id, variant_id, product_name, collection_name, colour, size, closure, pocket,
      personalization, price_class, qty, base_unit_cents, zipper_unit_cents, pocket_unit_cents, unit_cents, line_cents, image_url, sort_order
    ) VALUES (
      oid, nullif(item->>'product_id', '')::uuid, nullif(item->>'variant_id', '')::uuid, item->>'product_name', item->>'collection_name',
      item->>'colour', item->>'size', item->>'closure', coalesce((item->>'pocket')::boolean, false),
      nullif(item->>'personalization', ''), coalesce(item->>'price_class', 'standard'), (item->>'qty')::int,
      (item->>'base_unit_cents')::int, coalesce((item->>'zipper_unit_cents')::int, 0), coalesce((item->>'pocket_unit_cents')::int, 0),
      (item->>'unit_cents')::int, (item->>'line_cents')::int, item->>'image_url', i
    );
    i := i + 1;
  END LOOP;

  IF p->>'discount_code_id' IS NOT NULL AND p->>'discount_code_id' <> '' THEN
    PERFORM shop_reserve_discount((p->>'discount_code_id')::uuid, cid, oid, coalesce((p->>'savings_cents')::int, 0));
  END IF;

  IF link.id IS NOT NULL THEN
    UPDATE shop_private_order_links SET used_at = now(), order_id = oid WHERE id = link.id;
    UPDATE shop_design_projects SET status = 'final_order_submitted' WHERE id = link.project_id;
  END IF;

  INSERT INTO shop_audit_logs (actor_label, action, entity, entity_id, detail)
  VALUES ('customer', 'order.created', 'shop_orders', oid::text, jsonb_build_object('order_number', onum, 'total_cents', p->>'total_cents'));

  RETURN jsonb_build_object('order_id', oid, 'order_number', onum, 'duplicate', false, 'customer_id', cid, 'total_cents', (p->>'total_cents')::int);
END $$;

-- Only the service role (edge functions) may call the write helpers.
REVOKE ALL ON FUNCTION public.shop_next_number(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_rate_limit_hit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_reserve_discount(uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_upsert_customer(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_create_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_next_number(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_rate_limit_hit(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_reserve_discount(uuid, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_upsert_customer(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_create_order(jsonb) TO service_role;

-- ── Row level security ──────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shop_admins','shop_settings','shop_customers','shop_collections','shop_products','shop_product_variants',
    'shop_design_inquiries','shop_design_projects','shop_design_files','shop_revision_events','shop_private_order_links',
    'shop_discount_codes','shop_discount_redemptions','shop_orders','shop_order_items','shop_invoices','shop_invoice_lines',
    'shop_payments','shop_shipments','shop_email_events','shop_audit_logs','shop_rate_limits','shop_counters']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin all" ON public.%I', t);
    IF t NOT IN ('shop_rate_limits', 'shop_counters') THEN
      EXECUTE format('CREATE POLICY "admin all" ON public.%I FOR ALL TO authenticated USING (public.shop_is_admin()) WITH CHECK (public.shop_is_admin())', t);
    END IF;
  END LOOP;
END $$;

-- Admins can't add/remove other admins from the browser; done via SQL/dashboard.
DROP POLICY IF EXISTS "admin all" ON public.shop_admins;
DROP POLICY IF EXISTS "admin read self" ON public.shop_admins;
CREATE POLICY "admin read self" ON public.shop_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "public read visible collections" ON public.shop_collections;
CREATE POLICY "public read visible collections" ON public.shop_collections
  FOR SELECT TO anon, authenticated USING (visible AND NOT archived);

DROP POLICY IF EXISTS "public read active products" ON public.shop_products;
CREATE POLICY "public read active products" ON public.shop_products
  FOR SELECT TO anon, authenticated USING (status = 'active');

DROP POLICY IF EXISTS "public read variants" ON public.shop_product_variants;
CREATE POLICY "public read variants" ON public.shop_product_variants
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.shop_products p WHERE p.id = product_id AND p.status = 'active'));

DROP POLICY IF EXISTS "public read public settings" ON public.shop_settings;
CREATE POLICY "public read public settings" ON public.shop_settings
  FOR SELECT TO anon, authenticated USING (is_public);

-- ── Storage ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-products', 'shop-products', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-design-files', 'shop-design-files', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-invoices', 'shop-invoices', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "shop products public read" ON storage.objects;
CREATE POLICY "shop products public read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'shop-products');

DROP POLICY IF EXISTS "shop admin write products" ON storage.objects;
CREATE POLICY "shop admin write products" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id IN ('shop-products', 'shop-design-files', 'shop-invoices') AND public.shop_is_admin())
  WITH CHECK (bucket_id IN ('shop-products', 'shop-design-files', 'shop-invoices') AND public.shop_is_admin());

NOTIFY pgrst, 'reload schema';
