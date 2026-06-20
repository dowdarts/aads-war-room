-- Prevent double-sold/double-issued tickets on public.toc_tickets.
--
-- Rule (per AADS staff): a ticket with sold_status='SOLD' (PAID, COMP, or
-- still PENDING_PAYMENT — a pending order still occupies its seat) must
-- never be silently reassigned to a different person. The only way to free
-- it up is an explicit "Unissue" (which sets sold_status back to
-- 'AVAILABLE' in the same update). This closes a real gap where manual
-- ticket edits could set payment_status='PAID' without ever touching
-- sold_status, leaving the row eligible to be re-grabbed by
-- toc_reserve_ga/toc_reserve_vip (which select WHERE sold_status='AVAILABLE').

CREATE OR REPLACE FUNCTION public.toc_tickets_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Keep sold_status truthful: a PAID/COMP ticket can never be left AVAILABLE.
  IF NEW.payment_status IN ('PAID', 'COMP') AND NEW.sold_status = 'AVAILABLE' THEN
    NEW.sold_status := 'SOLD';
  END IF;

  -- Block reassigning an already-sold ticket unless it's being released
  -- (sold_status flips to AVAILABLE) in this same update.
  IF OLD.sold_status = 'SOLD' AND NEW.sold_status = 'SOLD' AND (
       NEW.ticket_holder_name IS DISTINCT FROM OLD.ticket_holder_name OR
       NEW.purchaser_name     IS DISTINCT FROM OLD.purchaser_name OR
       NEW.purchaser_email    IS DISTINCT FROM OLD.purchaser_email
     ) THEN
    RAISE EXCEPTION 'Ticket % is already sold/issued — unissue it first before reassigning.', OLD.ticket_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS toc_tickets_guard_trigger ON public.toc_tickets;
CREATE TRIGGER toc_tickets_guard_trigger
  BEFORE UPDATE ON public.toc_tickets
  FOR EACH ROW EXECUTE FUNCTION public.toc_tickets_guard();
