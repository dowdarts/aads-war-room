-- Fresh start for the Tournament of Champions ticket system.
--
-- Erases every existing order and ticket and reseeds the inventory:
--   VIP Table 1      — CGC Darts COMP (6 seats)
--   VIP Tables 2–6   — for sale, $120 per whole table (6 seats, $20/seat)
--   GA-001–064       — General Admission, $15 each
--
-- Ticket codes no longer carry the event date (it isn't set yet), so codes
-- and QR payloads from the July 2026 event stop scanning.
-- The old rows were exported to exports/toc-backup-2026-10-13/ before this ran.

-- ── 1. Wipe orders and tickets ───────────────────────────────────
TRUNCATE public.toc_tickets, public.toc_orders;

-- ── 2. Config ────────────────────────────────────────────────────
-- Sales stay closed until reopened from the ticket admin.
UPDATE public.toc_config SET
  sale_open       = false,
  vip_table_price = 120.00,
  ga_price        = 15.00,
  event_date_text = 'Date TBA',
  updated_at      = now()
WHERE id = 1;

-- ── 3. Inventory view — Tables 2–6 are now the sellable VIP tables ─
CREATE OR REPLACE VIEW public.toc_inventory AS
SELECT
  COUNT(*) FILTER (WHERE ticket_type='VIP' AND table_number BETWEEN 2 AND 6 AND sold_status='AVAILABLE' AND ticket_status='ACTIVE') / 6 AS vip_tables_available,
  COUNT(*) FILTER (WHERE ticket_type='VIP' AND table_number BETWEEN 2 AND 6 AND sold_status IN ('SOLD','RESERVED') AND ticket_status='ACTIVE') / 6 AS vip_tables_held,
  COUNT(*) FILTER (WHERE ticket_type='GA' AND ticket_group='General Admission' AND sold_status='AVAILABLE' AND ticket_status='ACTIVE') AS ga_public_available,
  COUNT(*) FILTER (WHERE ticket_type='GA' AND ticket_group='General Admission' AND sold_status IN ('SOLD','RESERVED') AND ticket_status='ACTIVE') AS ga_public_held
FROM public.toc_tickets;

-- ── 4. RPC: Reserve VIP table — same as before, Tables 2–6 ────────
-- A VIP purchase is always a whole table: all 6 seats or nothing.
CREATE OR REPLACE FUNCTION public.toc_reserve_vip(
  p_purchaser_name  text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_delivery_method text,
  p_order_number    text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cfg        public.toc_config%ROWTYPE;
  v_order_id   uuid;
  v_table      int;
  v_ticket_ids uuid[];
  v_tickets    jsonb;
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v_cfg FROM public.toc_config WHERE id = 1;

  IF NOT v_cfg.sale_open THEN
    RAISE EXCEPTION 'Ticket sales are currently closed.';
  END IF;

  SELECT table_number INTO v_table
  FROM public.toc_tickets
  WHERE ticket_type = 'VIP'
    AND table_number BETWEEN 2 AND 6
    AND sold_status = 'AVAILABLE'
    AND ticket_status = 'ACTIVE'
  GROUP BY table_number
  HAVING COUNT(*) = 6
  ORDER BY table_number
  LIMIT 1;

  IF v_table IS NULL THEN
    RAISE EXCEPTION 'No VIP tables are currently available.';
  END IF;

  SELECT array_agg(id ORDER BY seat_number) INTO v_ticket_ids
  FROM (
    SELECT id, seat_number FROM public.toc_tickets
    WHERE ticket_type = 'VIP'
      AND table_number = v_table
      AND sold_status = 'AVAILABLE'
      AND ticket_status = 'ACTIVE'
    FOR UPDATE SKIP LOCKED
  ) s;

  IF v_ticket_ids IS NULL OR array_length(v_ticket_ids, 1) <> 6 THEN
    RAISE EXCEPTION 'Selected VIP table is no longer available. Please try again.';
  END IF;

  v_expires_at := now() + (v_cfg.hold_minutes || ' minutes')::interval;

  INSERT INTO public.toc_orders
    (order_number, purchaser_name, purchaser_email, purchaser_phone,
     ticket_type, quantity, total_amount, delivery_method, expires_at)
  VALUES
    (p_order_number, p_purchaser_name, p_purchaser_email, p_purchaser_phone,
     'VIP_TABLE', 6, v_cfg.vip_table_price, p_delivery_method, v_expires_at)
  RETURNING id INTO v_order_id;

  UPDATE public.toc_tickets SET
    sold_status        = 'SOLD',
    payment_status     = 'PENDING_PAYMENT',
    order_id           = v_order_id,
    purchaser_name     = p_purchaser_name,
    purchaser_email    = p_purchaser_email,
    purchaser_phone    = p_purchaser_phone,
    ticket_holder_name = p_purchaser_name,
    delivery_method    = p_delivery_method,
    updated_at         = now()
  WHERE id = ANY(v_ticket_ids);

  SELECT jsonb_agg(jsonb_build_object(
    'ticket_code', ticket_code,
    'table_number', table_number,
    'seat_number', seat_number
  ) ORDER BY seat_number)
  INTO v_tickets
  FROM public.toc_tickets WHERE id = ANY(v_ticket_ids);

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', p_order_number,
    'table_number', v_table,
    'expires_at', v_expires_at,
    'tickets', v_tickets
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.toc_reserve_vip TO anon;

-- ── 5. Seed tickets ──────────────────────────────────────────────
-- VIP Table 1 — CGC Darts COMP
INSERT INTO public.toc_tickets
  (ticket_code, ticket_number, qr_payload, ticket_type, ticket_group,
   table_number, seat_number, price, sold_status, payment_status,
   ticket_holder_name, purchaser_name)
SELECT
  'AADS-TOC-VIP-T01-S' || lpad(s::text, 2, '0') || '-' || lpad(s::text, 3, '0'),
  'VIP-' || lpad(s::text, 3, '0'),
  'AADS-TOC-VIP-T01-S' || lpad(s::text, 2, '0') || '-' || lpad(s::text, 3, '0'),
  'VIP', 'VIP Table 1 - CGC Darts',
  1, s, 0.00, 'SOLD', 'COMP',
  'CGC Darts Guest', 'CGC Darts'
FROM generate_series(1, 6) AS s;

-- VIP Tables 2–6 — available for sale ($120/table)
INSERT INTO public.toc_tickets
  (ticket_code, ticket_number, qr_payload, ticket_type, ticket_group,
   table_number, seat_number, price, sold_status, payment_status)
SELECT
  'AADS-TOC-VIP-T' || lpad(t::text, 2, '0') || '-S' || lpad(s::text, 2, '0') || '-' || lpad(((t - 1) * 6 + s)::text, 3, '0'),
  'VIP-' || lpad(((t - 1) * 6 + s)::text, 3, '0'),
  'AADS-TOC-VIP-T' || lpad(t::text, 2, '0') || '-S' || lpad(s::text, 2, '0') || '-' || lpad(((t - 1) * 6 + s)::text, 3, '0'),
  'VIP', 'VIP Table ' || t,
  t, s, 20.00, 'AVAILABLE', 'UNPAID'
FROM generate_series(2, 6) AS t, generate_series(1, 6) AS s;

-- GA-001–064 — General Admission ($15 each)
INSERT INTO public.toc_tickets
  (ticket_code, ticket_number, qr_payload, ticket_type, ticket_group,
   price, sold_status, payment_status)
SELECT
  'AADS-TOC-GA-' || lpad(n::text, 3, '0'),
  'GA-' || lpad(n::text, 3, '0'),
  'AADS-TOC-GA-' || lpad(n::text, 3, '0'),
  'GA', 'General Admission',
  15.00, 'AVAILABLE', 'UNPAID'
FROM generate_series(1, 64) AS n;
