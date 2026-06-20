-- Broaden toc_tickets_guard()'s auto-sync: a ticket that's been assigned to
-- someone but is still PENDING_PAYMENT (not yet confirmed paid) was being
-- left at sold_status='AVAILABLE', the same gap that originally let PAID
-- tickets get re-grabbed — except this time for tickets nobody had even
-- marked paid yet. Per AADS staff: PENDING_PAYMENT counts as sold, only an
-- explicit Unissue (sold_status -> AVAILABLE) should free a seat back up.

CREATE OR REPLACE FUNCTION public.toc_tickets_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Keep sold_status truthful: an assigned ticket (PAID, COMP, or still
  -- PENDING_PAYMENT) can never be left AVAILABLE.
  IF NEW.payment_status IN ('PAID', 'COMP', 'PENDING_PAYMENT') AND NEW.sold_status = 'AVAILABLE' THEN
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
