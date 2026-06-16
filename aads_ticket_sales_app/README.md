# AADS Tournament of Champions Ticket Sales App

Static GitHub Pages ticket sale + Supabase backend for the Atlantic Amateur Darts Series Tournament of Champions.

## What this app does

- Sells General Admission tickets.
- Reserves full VIP tables.
- Prompts buyer to enter one attendee name per ticket.
- Stores each ticket holder name separately from the purchaser.
- Uses unique AADS ticket codes / QR payloads.
- Supports Supabase check-in scanning.
- Allows door staff to scan a ticket once and mark it checked in.
- Keeps tickets invalid until payment is marked PAID, unless they are comp tickets.

## Event setup

- Event: AADS Tournament of Champions
- Date: Saturday, July 25, 2026
- Doors Open: 8 AM
- Location: Club d'Age d'Or, Scoudouc, NB
- VIP Tables: 6 tables x 6 seats
- VIP Table 1: PharmaChoice reserved
- VIP Table 2: CGCDarts reserved
- VIP Tables 3-6: public VIP table packages
- General Admission: 64 tickets

## Important limitation

GitHub Pages is frontend-only. It cannot safely hold private server keys, process payments, send emails, or run Python ticket generation by itself.

This app is designed for:
- GitHub Pages frontend
- Supabase database + RPC functions
- Manual e-transfer payment approval to start
- Optional Stripe/email/PDF automation later through Supabase Edge Functions

## Quick setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run:
   - `supabase/schema.sql`
   - `supabase/seed_tickets.sql`
   - `supabase/rls_and_functions.sql`
4. Copy `js/config.example.js` to `js/config.js`.
5. Add your Supabase URL and anon key.
6. Upload this folder to a GitHub repo.
7. Turn on GitHub Pages from the repo settings.

## Pages

- `index.html` — public ticket sales page
- `scanner.html` — door scanner/check-in page
- `admin.html` — basic admin/order view

## Payment workflow

The first version is built for e-transfer/manual approval.

1. Buyer submits order.
2. Tickets are reserved as `PENDING_PAYMENT`.
3. Admin receives the order in Supabase/Admin page.
4. Admin confirms payment and marks tickets `PAID`.
5. Scanner accepts only `PAID` or comp tickets.
