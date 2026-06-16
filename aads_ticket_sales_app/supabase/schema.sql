create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  event_code text not null default 'AADS-TOC-2026',
  purchaser_name text not null,
  purchaser_email text not null,
  purchaser_phone text,
  ticket_type text not null check (ticket_type in ('GA','VIP_TABLE')),
  quantity integer not null,
  total_amount numeric(10,2) not null,
  order_status text not null default 'RESERVED',
  payment_status text not null default 'PENDING_PAYMENT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_code text not null default 'AADS-TOC-2026',
  ticket_code text unique not null,
  qr_payload text unique not null,
  ticket_type text not null check (ticket_type in ('GA','VIP')),
  ticket_group text not null,
  table_number integer,
  seat_number integer,
  price numeric(10,2) not null,
  ticket_holder_name text,
  purchaser_name text,
  purchaser_email text,
  purchaser_phone text,
  order_id uuid references public.orders(id),
  sold_status text not null default 'AVAILABLE',
  payment_status text not null default 'UNPAID',
  ticket_status text not null default 'ACTIVE',
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by text,
  scan_count integer not null default 0,
  last_scan_time timestamptz,
  wristband_issued boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_ticket_code_idx on public.tickets(ticket_code);
create index if not exists tickets_available_idx on public.tickets(ticket_type, sold_status, payment_status, ticket_status);
create index if not exists tickets_table_idx on public.tickets(table_number, seat_number);
