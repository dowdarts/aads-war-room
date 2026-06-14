-- ═══════════════════════════════════════════════════════════════════
-- AADS Tournament of Champions 2026 — Ticket System Migration
-- Run once in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Config singleton ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.toc_config (
  id               int     PRIMARY KEY DEFAULT 1,
  sale_open        boolean NOT NULL DEFAULT true,
  vip_table_price  numeric(10,2) NOT NULL DEFAULT 110.00,
  ga_price         numeric(10,2) NOT NULL DEFAULT 10.00,
  hold_minutes     int     NOT NULL DEFAULT 45,
  event_name       text    DEFAULT 'AADS Tournament of Champions Presented by Amherst PharmaChoice',
  event_date_text  text    DEFAULT 'Saturday, July 25, 2026',
  event_location   text    DEFAULT 'Club d''Age d''Or, Scoudouc, NB'
);
INSERT INTO public.toc_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 2. Orders table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.toc_orders (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    text    UNIQUE NOT NULL,
  order_type      text    NOT NULL DEFAULT 'public'
    CHECK (order_type IN ('public', 'player_reserve')),
  purchaser_name  text    NOT NULL,
  purchaser_email text,
  purchaser_phone text,
  ticket_type     text    NOT NULL CHECK (ticket_type IN ('GA', 'VIP_TABLE')),
  quantity        int     NOT NULL,
  total_amount    numeric(10,2) NOT NULL,
  delivery_method text    CHECK (delivery_method IN ('pickup', 'virtual')),
  payment_status  text    NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK (payment_status IN ('PENDING_PAYMENT','PAID','COMP','CANCELLED')),
  expires_at      timestamptz,
  notes           text,
  confirmed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Tickets table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.toc_tickets (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code       text    UNIQUE NOT NULL,
  ticket_number     text    NOT NULL,
  qr_payload        text    UNIQUE NOT NULL,
  ticket_type       text    NOT NULL CHECK (ticket_type IN ('GA', 'VIP')),
  ticket_group      text    NOT NULL,
  table_number      int,
  seat_number       int,
  price             numeric(10,2) NOT NULL DEFAULT 0,
  ticket_holder_name text,
  purchaser_name    text,
  purchaser_email   text,
  purchaser_phone   text,
  order_id          uuid    REFERENCES public.toc_orders(id),
  sold_status       text    NOT NULL DEFAULT 'AVAILABLE'
    CHECK (sold_status IN ('AVAILABLE','RESERVED','SOLD','VOID')),
  payment_status    text    NOT NULL DEFAULT 'UNPAID'
    CHECK (payment_status IN ('UNPAID','PENDING_PAYMENT','PAID','COMP')),
  ticket_status     text    NOT NULL DEFAULT 'ACTIVE'
    CHECK (ticket_status IN ('ACTIVE','VOID')),
  delivery_method   text,
  checked_in        boolean NOT NULL DEFAULT false,
  checked_in_at     timestamptz,
  checked_in_by     text,
  scan_count        int     NOT NULL DEFAULT 0,
  last_scanned_at   timestamptz,
  wristband_issued  boolean NOT NULL DEFAULT false,
  generated         boolean NOT NULL DEFAULT false,
  generated_at      timestamptz,
  print_file        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS toc_tickets_code_idx ON public.toc_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS toc_tickets_qr_idx ON public.toc_tickets(qr_payload);
CREATE INDEX IF NOT EXISTS toc_tickets_status_idx ON public.toc_tickets(ticket_type, sold_status, payment_status, ticket_status);
CREATE INDEX IF NOT EXISTS toc_tickets_table_idx ON public.toc_tickets(table_number, seat_number);
CREATE INDEX IF NOT EXISTS toc_orders_number_idx ON public.toc_orders(order_number);
CREATE INDEX IF NOT EXISTS toc_orders_expires_idx ON public.toc_orders(expires_at);

-- ── 5. RLS ───────────────────────────────────────────────────────
ALTER TABLE public.toc_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toc_orders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toc_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read config"    ON public.toc_config;
DROP POLICY IF EXISTS "anon update config"  ON public.toc_config;
DROP POLICY IF EXISTS "anon read tickets"   ON public.toc_tickets;
DROP POLICY IF EXISTS "anon update tickets" ON public.toc_tickets;
DROP POLICY IF EXISTS "anon read orders"    ON public.toc_orders;
DROP POLICY IF EXISTS "anon update orders"  ON public.toc_orders;
DROP POLICY IF EXISTS "anon delete orders"  ON public.toc_orders;

CREATE POLICY "anon read config"    ON public.toc_config  FOR SELECT TO anon USING (true);
CREATE POLICY "anon update config"  ON public.toc_config  FOR UPDATE TO anon USING (true);
CREATE POLICY "anon read tickets"   ON public.toc_tickets FOR SELECT TO anon USING (true);
CREATE POLICY "anon update tickets" ON public.toc_tickets FOR UPDATE TO anon USING (true);
CREATE POLICY "anon read orders"    ON public.toc_orders  FOR SELECT TO anon USING (true);
CREATE POLICY "anon update orders"  ON public.toc_orders  FOR UPDATE TO anon USING (true);
CREATE POLICY "anon delete orders"  ON public.toc_orders  FOR DELETE TO anon USING (true);

-- ── 6. Inventory view ────────────────────────────────────────────
CREATE OR REPLACE VIEW public.toc_inventory AS
SELECT
  COUNT(*) FILTER (WHERE ticket_type='VIP' AND table_number BETWEEN 3 AND 6 AND sold_status='AVAILABLE' AND ticket_status='ACTIVE') / 6 AS vip_tables_available,
  COUNT(*) FILTER (WHERE ticket_type='VIP' AND table_number BETWEEN 3 AND 6 AND sold_status IN ('RESERVED','SOLD') AND ticket_status='ACTIVE') / 6 AS vip_tables_held,
  COUNT(*) FILTER (WHERE ticket_type='GA' AND ticket_group='General Admission' AND sold_status='AVAILABLE' AND ticket_status='ACTIVE') AS ga_public_available,
  COUNT(*) FILTER (WHERE ticket_type='GA' AND ticket_group='General Admission' AND sold_status IN ('RESERVED','SOLD') AND ticket_status='ACTIVE') AS ga_public_held,
  COUNT(*) FILTER (WHERE ticket_type='GA' AND ticket_group LIKE 'Player Reserve%' AND sold_status='RESERVED' AND ticket_status='ACTIVE') AS player_reserve_held,
  COUNT(*) FILTER (WHERE ticket_type='GA' AND ticket_group LIKE 'Player Reserve%' AND sold_status='AVAILABLE' AND ticket_status='ACTIVE') AS player_reserve_released
FROM public.toc_tickets;

-- ── 7. RPC: Reserve GA tickets ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.toc_reserve_ga(
  p_purchaser_name  text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_attendee_name   text,
  p_quantity        int,
  p_delivery_method text,
  p_order_number    text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cfg        public.toc_config%ROWTYPE;
  v_order_id   uuid;
  v_ticket_ids uuid[];
  v_tickets    jsonb;
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v_cfg FROM public.toc_config WHERE id = 1;

  IF NOT v_cfg.sale_open THEN
    RAISE EXCEPTION 'Ticket sales are currently closed.';
  END IF;

  IF p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 10.';
  END IF;

  SELECT array_agg(id) INTO v_ticket_ids
  FROM (
    SELECT id FROM public.toc_tickets
    WHERE ticket_type = 'GA'
      AND ticket_group = 'General Admission'
      AND sold_status = 'AVAILABLE'
      AND ticket_status = 'ACTIVE'
    ORDER BY ticket_code
    FOR UPDATE SKIP LOCKED
    LIMIT p_quantity
  ) s;

  IF v_ticket_ids IS NULL OR array_length(v_ticket_ids, 1) < p_quantity THEN
    RAISE EXCEPTION 'Not enough General Admission tickets available.';
  END IF;

  v_expires_at := now() + (v_cfg.hold_minutes || ' minutes')::interval;

  INSERT INTO public.toc_orders
    (order_number, purchaser_name, purchaser_email, purchaser_phone,
     ticket_type, quantity, total_amount, delivery_method, expires_at)
  VALUES
    (p_order_number, p_purchaser_name, p_purchaser_email, p_purchaser_phone,
     'GA', p_quantity, p_quantity * v_cfg.ga_price, p_delivery_method, v_expires_at)
  RETURNING id INTO v_order_id;

  UPDATE public.toc_tickets SET
    sold_status        = 'RESERVED',
    payment_status     = 'PENDING_PAYMENT',
    order_id           = v_order_id,
    purchaser_name     = p_purchaser_name,
    purchaser_email    = p_purchaser_email,
    purchaser_phone    = p_purchaser_phone,
    ticket_holder_name = p_attendee_name,
    delivery_method    = p_delivery_method,
    updated_at         = now()
  WHERE id = ANY(v_ticket_ids);

  SELECT jsonb_agg(jsonb_build_object(
    'ticket_code', ticket_code,
    'ticket_holder_name', ticket_holder_name
  ) ORDER BY ticket_code)
  INTO v_tickets
  FROM public.toc_tickets WHERE id = ANY(v_ticket_ids);

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', p_order_number,
    'expires_at', v_expires_at,
    'tickets', v_tickets
  );
END;
$$;

-- ── 8. RPC: Reserve VIP table ────────────────────────────────────
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
    AND table_number BETWEEN 3 AND 6
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
    sold_status        = 'RESERVED',
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

-- ── 9. RPC: Check in ticket (door scanner) ───────────────────────
CREATE OR REPLACE FUNCTION public.toc_check_in(
  p_ticket_code    text,
  p_checked_in_by  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ticket public.toc_tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket
  FROM public.toc_tickets
  WHERE ticket_code = p_ticket_code OR qr_payload = p_ticket_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'status', 'NOT_FOUND',
      'message', 'Ticket not found in the system.');
  END IF;

  IF v_ticket.ticket_status = 'VOID' THEN
    RETURN jsonb_build_object('allowed', false, 'status', 'VOID',
      'message', 'This ticket has been voided/cancelled.',
      'ticket_code', v_ticket.ticket_code);
  END IF;

  IF v_ticket.payment_status NOT IN ('PAID', 'COMP') THEN
    RETURN jsonb_build_object('allowed', false, 'status', 'UNPAID',
      'message', 'Payment not confirmed. Do not admit. Contact admin.',
      'ticket_code', v_ticket.ticket_code,
      'ticket_holder_name', v_ticket.ticket_holder_name,
      'ticket_type', v_ticket.ticket_type);
  END IF;

  IF v_ticket.checked_in THEN
    UPDATE public.toc_tickets SET
      scan_count = scan_count + 1, last_scanned_at = now(), updated_at = now()
    WHERE id = v_ticket.id;
    RETURN jsonb_build_object('allowed', false, 'status', 'ALREADY_IN',
      'message', 'Already checked in.',
      'ticket_code', v_ticket.ticket_code,
      'ticket_holder_name', v_ticket.ticket_holder_name,
      'ticket_type', v_ticket.ticket_type,
      'ticket_group', v_ticket.ticket_group,
      'table_number', v_ticket.table_number,
      'seat_number', v_ticket.seat_number,
      'checked_in_at', v_ticket.checked_in_at,
      'checked_in_by', v_ticket.checked_in_by,
      'scan_count', v_ticket.scan_count + 1);
  END IF;

  UPDATE public.toc_tickets SET
    checked_in       = true,
    checked_in_at    = now(),
    checked_in_by    = p_checked_in_by,
    scan_count       = scan_count + 1,
    last_scanned_at   = now(),
    wristband_issued = true,
    updated_at       = now()
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'allowed', true, 'status', 'VALID',
    'message', 'Valid ticket. Issue wristband.',
    'ticket_code', v_ticket.ticket_code,
    'ticket_holder_name', v_ticket.ticket_holder_name,
    'ticket_type', v_ticket.ticket_type,
    'ticket_group', v_ticket.ticket_group,
    'table_number', v_ticket.table_number,
    'seat_number', v_ticket.seat_number,
    'payment_status', v_ticket.payment_status
  );
END;
$$;

-- ── 10. Seed all tickets ─────────────────────────────────────────
-- VIP Table 1 — PharmaChoice COMP (pre-assigned, not for sale)
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,table_number,seat_number,price,sold_status,payment_status,ticket_holder_name,purchaser_name,generated) VALUES
('AADS-TOC-20260725-VIP-T01-S01-001','VIP-001','AADS-TOC-20260725-VIP-T01-S01-001','VIP','VIP Table 1 - PharmaChoice',1,1,0.00,'RESERVED','COMP','Corey O''Brien','Amherst PharmaChoice',true),
('AADS-TOC-20260725-VIP-T01-S02-002','VIP-002','AADS-TOC-20260725-VIP-T01-S02-002','VIP','VIP Table 1 - PharmaChoice',1,2,0.00,'RESERVED','COMP','Jennifer O''Brien','Amherst PharmaChoice',true),
('AADS-TOC-20260725-VIP-T01-S03-003','VIP-003','AADS-TOC-20260725-VIP-T01-S03-003','VIP','VIP Table 1 - PharmaChoice',1,3,0.00,'RESERVED','COMP','PharmaChoice Partner','Amherst PharmaChoice',true),
('AADS-TOC-20260725-VIP-T01-S04-004','VIP-004','AADS-TOC-20260725-VIP-T01-S04-004','VIP','VIP Table 1 - PharmaChoice',1,4,0.00,'RESERVED','COMP','PharmaChoice Partner','Amherst PharmaChoice',true),
('AADS-TOC-20260725-VIP-T01-S05-005','VIP-005','AADS-TOC-20260725-VIP-T01-S05-005','VIP','VIP Table 1 - PharmaChoice',1,5,0.00,'RESERVED','COMP','PharmaChoice Partner','Amherst PharmaChoice',true),
('AADS-TOC-20260725-VIP-T01-S06-006','VIP-006','AADS-TOC-20260725-VIP-T01-S06-006','VIP','VIP Table 1 - PharmaChoice',1,6,0.00,'RESERVED','COMP','PharmaChoice Partner','Amherst PharmaChoice',true)
ON CONFLICT (ticket_code) DO NOTHING;

-- VIP Table 2 — CGC Darts COMP (pre-assigned, not for sale)
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,table_number,seat_number,price,sold_status,payment_status,ticket_holder_name,purchaser_name,generated) VALUES
('AADS-TOC-20260725-VIP-T02-S01-007','VIP-007','AADS-TOC-20260725-VIP-T02-S01-007','VIP','VIP Table 2 - CGC Darts',2,1,0.00,'RESERVED','COMP','Cecil Dow','CGC Darts',true),
('AADS-TOC-20260725-VIP-T02-S02-008','VIP-008','AADS-TOC-20260725-VIP-T02-S02-008','VIP','VIP Table 2 - CGC Darts',2,2,0.00,'RESERVED','COMP','Connie Dow','CGC Darts',true),
('AADS-TOC-20260725-VIP-T02-S03-009','VIP-009','AADS-TOC-20260725-VIP-T02-S03-009','VIP','VIP Table 2 - CGC Darts',2,3,0.00,'RESERVED','COMP','Tanya Holland','CGC Darts',true),
('AADS-TOC-20260725-VIP-T02-S04-010','VIP-010','AADS-TOC-20260725-VIP-T02-S04-010','VIP','VIP Table 2 - CGC Darts',2,4,0.00,'RESERVED','COMP','Dawn Leblanc','CGC Darts',true),
('AADS-TOC-20260725-VIP-T02-S05-011','VIP-011','AADS-TOC-20260725-VIP-T02-S05-011','VIP','VIP Table 2 - CGC Darts',2,5,0.00,'RESERVED','COMP','CGC Darts Guest','CGC Darts',true),
('AADS-TOC-20260725-VIP-T02-S06-012','VIP-012','AADS-TOC-20260725-VIP-T02-S06-012','VIP','VIP Table 2 - CGC Darts',2,6,0.00,'RESERVED','COMP','CGC Darts Guest','CGC Darts',true)
ON CONFLICT (ticket_code) DO NOTHING;

-- VIP Tables 3–6 — Available for sale ($110/table)
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,table_number,seat_number,price,sold_status,payment_status) VALUES
('AADS-TOC-20260725-VIP-T03-S01-013','VIP-013','AADS-TOC-20260725-VIP-T03-S01-013','VIP','VIP Table 3',3,1,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T03-S02-014','VIP-014','AADS-TOC-20260725-VIP-T03-S02-014','VIP','VIP Table 3',3,2,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T03-S03-015','VIP-015','AADS-TOC-20260725-VIP-T03-S03-015','VIP','VIP Table 3',3,3,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T03-S04-016','VIP-016','AADS-TOC-20260725-VIP-T03-S04-016','VIP','VIP Table 3',3,4,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T03-S05-017','VIP-017','AADS-TOC-20260725-VIP-T03-S05-017','VIP','VIP Table 3',3,5,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T03-S06-018','VIP-018','AADS-TOC-20260725-VIP-T03-S06-018','VIP','VIP Table 3',3,6,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T04-S01-019','VIP-019','AADS-TOC-20260725-VIP-T04-S01-019','VIP','VIP Table 4',4,1,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T04-S02-020','VIP-020','AADS-TOC-20260725-VIP-T04-S02-020','VIP','VIP Table 4',4,2,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T04-S03-021','VIP-021','AADS-TOC-20260725-VIP-T04-S03-021','VIP','VIP Table 4',4,3,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T04-S04-022','VIP-022','AADS-TOC-20260725-VIP-T04-S04-022','VIP','VIP Table 4',4,4,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T04-S05-023','VIP-023','AADS-TOC-20260725-VIP-T04-S05-023','VIP','VIP Table 4',4,5,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T04-S06-024','VIP-024','AADS-TOC-20260725-VIP-T04-S06-024','VIP','VIP Table 4',4,6,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T05-S01-025','VIP-025','AADS-TOC-20260725-VIP-T05-S01-025','VIP','VIP Table 5',5,1,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T05-S02-026','VIP-026','AADS-TOC-20260725-VIP-T05-S02-026','VIP','VIP Table 5',5,2,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T05-S03-027','VIP-027','AADS-TOC-20260725-VIP-T05-S03-027','VIP','VIP Table 5',5,3,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T05-S04-028','VIP-028','AADS-TOC-20260725-VIP-T05-S04-028','VIP','VIP Table 5',5,4,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T05-S05-029','VIP-029','AADS-TOC-20260725-VIP-T05-S05-029','VIP','VIP Table 5',5,5,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T05-S06-030','VIP-030','AADS-TOC-20260725-VIP-T05-S06-030','VIP','VIP Table 5',5,6,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T06-S01-031','VIP-031','AADS-TOC-20260725-VIP-T06-S01-031','VIP','VIP Table 6',6,1,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T06-S02-032','VIP-032','AADS-TOC-20260725-VIP-T06-S02-032','VIP','VIP Table 6',6,2,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T06-S03-033','VIP-033','AADS-TOC-20260725-VIP-T06-S03-033','VIP','VIP Table 6',6,3,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T06-S04-034','VIP-034','AADS-TOC-20260725-VIP-T06-S04-034','VIP','VIP Table 6',6,4,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T06-S05-035','VIP-035','AADS-TOC-20260725-VIP-T06-S05-035','VIP','VIP Table 6',6,5,18.33,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-VIP-T06-S06-036','VIP-036','AADS-TOC-20260725-VIP-T06-S06-036','VIP','VIP Table 6',6,6,18.33,'AVAILABLE','UNPAID')
ON CONFLICT (ticket_code) DO NOTHING;

-- GA-001–005: Tom Holden player reserve (5 tickets, $10 each, pre-blocked)
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,price,sold_status,payment_status) VALUES
('AADS-TOC-20260725-GA-001','GA-001','AADS-TOC-20260725-GA-001','GA','Player Reserve - Tom Holden',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-002','GA-002','AADS-TOC-20260725-GA-002','GA','Player Reserve - Tom Holden',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-003','GA-003','AADS-TOC-20260725-GA-003','GA','Player Reserve - Tom Holden',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-004','GA-004','AADS-TOC-20260725-GA-004','GA','Player Reserve - Tom Holden',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-005','GA-005','AADS-TOC-20260725-GA-005','GA','Player Reserve - Tom Holden',10.00,'RESERVED','UNPAID')
ON CONFLICT (ticket_code) DO NOTHING;

-- GA-006–010: Kyle Gray player reserve
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,price,sold_status,payment_status) VALUES
('AADS-TOC-20260725-GA-006','GA-006','AADS-TOC-20260725-GA-006','GA','Player Reserve - Kyle Gray',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-007','GA-007','AADS-TOC-20260725-GA-007','GA','Player Reserve - Kyle Gray',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-008','GA-008','AADS-TOC-20260725-GA-008','GA','Player Reserve - Kyle Gray',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-009','GA-009','AADS-TOC-20260725-GA-009','GA','Player Reserve - Kyle Gray',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-010','GA-010','AADS-TOC-20260725-GA-010','GA','Player Reserve - Kyle Gray',10.00,'RESERVED','UNPAID')
ON CONFLICT (ticket_code) DO NOTHING;

-- GA-011–015: Tyler Cyr player reserve
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,price,sold_status,payment_status) VALUES
('AADS-TOC-20260725-GA-011','GA-011','AADS-TOC-20260725-GA-011','GA','Player Reserve - Tyler Cyr',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-012','GA-012','AADS-TOC-20260725-GA-012','GA','Player Reserve - Tyler Cyr',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-013','GA-013','AADS-TOC-20260725-GA-013','GA','Player Reserve - Tyler Cyr',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-014','GA-014','AADS-TOC-20260725-GA-014','GA','Player Reserve - Tyler Cyr',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-015','GA-015','AADS-TOC-20260725-GA-015','GA','Player Reserve - Tyler Cyr',10.00,'RESERVED','UNPAID')
ON CONFLICT (ticket_code) DO NOTHING;

-- GA-016–020: Drake Berry player reserve
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,price,sold_status,payment_status) VALUES
('AADS-TOC-20260725-GA-016','GA-016','AADS-TOC-20260725-GA-016','GA','Player Reserve - Drake Berry',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-017','GA-017','AADS-TOC-20260725-GA-017','GA','Player Reserve - Drake Berry',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-018','GA-018','AADS-TOC-20260725-GA-018','GA','Player Reserve - Drake Berry',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-019','GA-019','AADS-TOC-20260725-GA-019','GA','Player Reserve - Drake Berry',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-020','GA-020','AADS-TOC-20260725-GA-020','GA','Player Reserve - Drake Berry',10.00,'RESERVED','UNPAID')
ON CONFLICT (ticket_code) DO NOTHING;

-- GA-021–025: Dee Cormier player reserve
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,price,sold_status,payment_status) VALUES
('AADS-TOC-20260725-GA-021','GA-021','AADS-TOC-20260725-GA-021','GA','Player Reserve - Dee Cormier',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-022','GA-022','AADS-TOC-20260725-GA-022','GA','Player Reserve - Dee Cormier',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-023','GA-023','AADS-TOC-20260725-GA-023','GA','Player Reserve - Dee Cormier',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-024','GA-024','AADS-TOC-20260725-GA-024','GA','Player Reserve - Dee Cormier',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-025','GA-025','AADS-TOC-20260725-GA-025','GA','Player Reserve - Dee Cormier',10.00,'RESERVED','UNPAID')
ON CONFLICT (ticket_code) DO NOTHING;

-- GA-026–030: Rob Sibbick player reserve
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,price,sold_status,payment_status) VALUES
('AADS-TOC-20260725-GA-026','GA-026','AADS-TOC-20260725-GA-026','GA','Player Reserve - Rob Sibbick',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-027','GA-027','AADS-TOC-20260725-GA-027','GA','Player Reserve - Rob Sibbick',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-028','GA-028','AADS-TOC-20260725-GA-028','GA','Player Reserve - Rob Sibbick',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-029','GA-029','AADS-TOC-20260725-GA-029','GA','Player Reserve - Rob Sibbick',10.00,'RESERVED','UNPAID'),
('AADS-TOC-20260725-GA-030','GA-030','AADS-TOC-20260725-GA-030','GA','Player Reserve - Rob Sibbick',10.00,'RESERVED','UNPAID')
ON CONFLICT (ticket_code) DO NOTHING;

-- GA-031–064: Public General Admission pool (34 tickets)
INSERT INTO public.toc_tickets (ticket_code,ticket_number,qr_payload,ticket_type,ticket_group,price,sold_status,payment_status) VALUES
('AADS-TOC-20260725-GA-031','GA-031','AADS-TOC-20260725-GA-031','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-032','GA-032','AADS-TOC-20260725-GA-032','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-033','GA-033','AADS-TOC-20260725-GA-033','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-034','GA-034','AADS-TOC-20260725-GA-034','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-035','GA-035','AADS-TOC-20260725-GA-035','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-036','GA-036','AADS-TOC-20260725-GA-036','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-037','GA-037','AADS-TOC-20260725-GA-037','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-038','GA-038','AADS-TOC-20260725-GA-038','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-039','GA-039','AADS-TOC-20260725-GA-039','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-040','GA-040','AADS-TOC-20260725-GA-040','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-041','GA-041','AADS-TOC-20260725-GA-041','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-042','GA-042','AADS-TOC-20260725-GA-042','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-043','GA-043','AADS-TOC-20260725-GA-043','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-044','GA-044','AADS-TOC-20260725-GA-044','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-045','GA-045','AADS-TOC-20260725-GA-045','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-046','GA-046','AADS-TOC-20260725-GA-046','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-047','GA-047','AADS-TOC-20260725-GA-047','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-048','GA-048','AADS-TOC-20260725-GA-048','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-049','GA-049','AADS-TOC-20260725-GA-049','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-050','GA-050','AADS-TOC-20260725-GA-050','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-051','GA-051','AADS-TOC-20260725-GA-051','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-052','GA-052','AADS-TOC-20260725-GA-052','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-053','GA-053','AADS-TOC-20260725-GA-053','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-054','GA-054','AADS-TOC-20260725-GA-054','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-055','GA-055','AADS-TOC-20260725-GA-055','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-056','GA-056','AADS-TOC-20260725-GA-056','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-057','GA-057','AADS-TOC-20260725-GA-057','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-058','GA-058','AADS-TOC-20260725-GA-058','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-059','GA-059','AADS-TOC-20260725-GA-059','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-060','GA-060','AADS-TOC-20260725-GA-060','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-061','GA-061','AADS-TOC-20260725-GA-061','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-062','GA-062','AADS-TOC-20260725-GA-062','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-063','GA-063','AADS-TOC-20260725-GA-063','GA','General Admission',10.00,'AVAILABLE','UNPAID'),
('AADS-TOC-20260725-GA-064','GA-064','AADS-TOC-20260725-GA-064','GA','General Admission',10.00,'AVAILABLE','UNPAID')
ON CONFLICT (ticket_code) DO NOTHING;

-- ── Done! ────────────────────────────────────────────────────────
-- Inventory after seed:
--   VIP: 4 tables available (Tables 3-6), 2 COMP tables (Tables 1-2)
--   GA public pool: 34 tickets available (GA-031 to GA-064)
--   GA player reserves: 30 tickets held (GA-001 to GA-030, 5 per player)
