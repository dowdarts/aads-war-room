alter table public.orders enable row level security;
alter table public.tickets enable row level security;

-- Public users can create an order through RPC only. Do not allow direct public table updates.
drop policy if exists "public can insert orders" on public.orders;
drop policy if exists "public can view own maybe not implemented" on public.orders;
drop policy if exists "public can view available tickets count" on public.tickets;

create policy "public can view available tickets count"
on public.tickets for select
to anon
using (ticket_status = 'ACTIVE');

-- In production, tighten admin policies with Supabase Auth and an admin_users table.
-- For a first controlled event, use Supabase dashboard to mark payments as PAID.

create or replace function public.reserve_ga_tickets(
  p_purchaser_name text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_ticket_type text,
  p_attendee_names text[]
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_qty int := array_length(p_attendee_names, 1);
  v_order_id uuid;
  v_total numeric(10,2);
  v_ticket_ids uuid[];
  v_tickets jsonb;
begin
  if p_ticket_type <> 'GA' then
    raise exception 'Invalid ticket type for GA reservation.';
  end if;

  if v_qty is null or v_qty < 1 or v_qty > 10 then
    raise exception 'GA quantity must be between 1 and 10.';
  end if;

  select array_agg(id)
  into v_ticket_ids
  from (
    select id
    from public.tickets
    where ticket_type = 'GA'
      and sold_status = 'AVAILABLE'
      and ticket_status = 'ACTIVE'
    order by ticket_code
    for update skip locked
    limit v_qty
  ) s;

  if array_length(v_ticket_ids, 1) <> v_qty then
    raise exception 'Not enough General Admission tickets available.';
  end if;

  v_total := v_qty * 10.00;

  insert into public.orders (purchaser_name, purchaser_email, purchaser_phone, ticket_type, quantity, total_amount)
  values (p_purchaser_name, p_purchaser_email, p_purchaser_phone, 'GA', v_qty, v_total)
  returning id into v_order_id;

  update public.tickets t
  set sold_status = 'RESERVED',
      payment_status = 'PENDING_PAYMENT',
      order_id = v_order_id,
      purchaser_name = p_purchaser_name,
      purchaser_email = p_purchaser_email,
      purchaser_phone = p_purchaser_phone,
      ticket_holder_name = p_attendee_names[array_position(v_ticket_ids, t.id)],
      updated_at = now()
  where t.id = any(v_ticket_ids);

  select jsonb_agg(jsonb_build_object(
    'ticket_code', ticket_code,
    'ticket_holder_name', ticket_holder_name,
    'ticket_type', ticket_type
  ) order by ticket_code)
  into v_tickets
  from public.tickets
  where id = any(v_ticket_ids);

  return jsonb_build_object('order_id', v_order_id, 'tickets', v_tickets);
end;
$$;

create or replace function public.reserve_vip_table(
  p_purchaser_name text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_ticket_type text,
  p_attendee_names text[]
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order_id uuid;
  v_table int;
  v_ticket_ids uuid[];
  v_tickets jsonb;
begin
  if p_ticket_type <> 'VIP_TABLE' then
    raise exception 'Invalid ticket type for VIP table reservation.';
  end if;

  if array_length(p_attendee_names, 1) <> 6 then
    raise exception 'VIP table purchase requires exactly 6 attendee names.';
  end if;

  select table_number
  into v_table
  from public.tickets
  where ticket_type = 'VIP'
    and table_number between 3 and 6
    and sold_status = 'AVAILABLE'
    and ticket_status = 'ACTIVE'
  group by table_number
  having count(*) = 6
  order by table_number
  limit 1;

  if v_table is null then
    raise exception 'No full VIP tables are available.';
  end if;

  select array_agg(id order by seat_number)
  into v_ticket_ids
  from (
    select id, seat_number
    from public.tickets
    where ticket_type = 'VIP'
      and table_number = v_table
      and sold_status = 'AVAILABLE'
      and ticket_status = 'ACTIVE'
    order by seat_number
    for update skip locked
  ) s;

  if array_length(v_ticket_ids, 1) <> 6 then
    raise exception 'Selected VIP table is no longer available.';
  end if;

  insert into public.orders (purchaser_name, purchaser_email, purchaser_phone, ticket_type, quantity, total_amount)
  values (p_purchaser_name, p_purchaser_email, p_purchaser_phone, 'VIP_TABLE', 6, 110.00)
  returning id into v_order_id;

  update public.tickets t
  set sold_status = 'RESERVED',
      payment_status = 'PENDING_PAYMENT',
      order_id = v_order_id,
      purchaser_name = p_purchaser_name,
      purchaser_email = p_purchaser_email,
      purchaser_phone = p_purchaser_phone,
      ticket_holder_name = p_attendee_names[array_position(v_ticket_ids, t.id)],
      price = 110.00 / 6.00,
      updated_at = now()
  where t.id = any(v_ticket_ids);

  select jsonb_agg(jsonb_build_object(
    'ticket_code', ticket_code,
    'ticket_holder_name', ticket_holder_name,
    'ticket_type', ticket_type,
    'table_number', table_number,
    'seat_number', seat_number
  ) order by seat_number)
  into v_tickets
  from public.tickets
  where id = any(v_ticket_ids);

  return jsonb_build_object('order_id', v_order_id, 'table_number', v_table, 'tickets', v_tickets);
end;
$$;

create or replace function public.check_in_ticket(
  p_ticket_code text,
  p_checked_in_by text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ticket public.tickets%rowtype;
begin
  select *
  into v_ticket
  from public.tickets
  where ticket_code = p_ticket_code
     or qr_payload = p_ticket_code
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'message', 'Ticket not found.');
  end if;

  if v_ticket.ticket_status <> 'ACTIVE' then
    return jsonb_build_object('allowed', false, 'message', 'Ticket is not active.', 'ticket_code', v_ticket.ticket_code);
  end if;

  if v_ticket.payment_status not in ('PAID') then
    return jsonb_build_object(
      'allowed', false,
      'message', 'Ticket is not paid/confirmed yet.',
      'ticket_code', v_ticket.ticket_code,
      'ticket_holder_name', v_ticket.ticket_holder_name,
      'ticket_type', v_ticket.ticket_type,
      'table_number', v_ticket.table_number,
      'seat_number', v_ticket.seat_number
    );
  end if;

  if v_ticket.checked_in then
    return jsonb_build_object(
      'allowed', false,
      'message', 'Ticket already checked in.',
      'ticket_code', v_ticket.ticket_code,
      'ticket_holder_name', v_ticket.ticket_holder_name,
      'ticket_type', v_ticket.ticket_type,
      'table_number', v_ticket.table_number,
      'seat_number', v_ticket.seat_number,
      'checked_in_at', v_ticket.checked_in_at
    );
  end if;

  update public.tickets
  set checked_in = true,
      checked_in_at = now(),
      checked_in_by = p_checked_in_by,
      scan_count = scan_count + 1,
      last_scan_time = now(),
      wristband_issued = true,
      updated_at = now()
  where id = v_ticket.id;

  return jsonb_build_object(
    'allowed', true,
    'message', 'Valid ticket. Issue wristband.',
    'ticket_code', v_ticket.ticket_code,
    'ticket_holder_name', v_ticket.ticket_holder_name,
    'ticket_type', v_ticket.ticket_type,
    'table_number', v_ticket.table_number,
    'seat_number', v_ticket.seat_number
  );
end;
$$;
