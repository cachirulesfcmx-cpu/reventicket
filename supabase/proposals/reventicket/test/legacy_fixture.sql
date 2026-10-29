-- Recreates the RevenTicket legacy tables exactly as they exist in the remote project
-- (structure read from information_schema on 2026-10-29; no remote data is copied).
-- Runs as rt_owner, the local stand-in for Supabase's `postgres` role.
create table public.users (
  id varchar primary key default gen_random_uuid()::text, email text not null unique, password text not null,
  first_name text not null, last_name text not null, role text not null default 'buyer', created_at timestamp not null default now());
create table public.venues (
  id varchar primary key default gen_random_uuid()::text, name text not null, city text not null, address text,
  capacity integer, map_data json, image text);
create table public.events (
  id varchar primary key default gen_random_uuid()::text, title text not null, category text not null, date timestamp not null,
  venue_id varchar not null references public.venues(id), image text, min_price numeric(10,2), tags json default '[]'::json,
  description text, created_at timestamp not null default now());
create table public.zones (
  id varchar primary key default gen_random_uuid()::text, event_id varchar not null references public.events(id) on delete cascade,
  name text not null, color text, base_price numeric(10,2) not null);
create table public.tickets (
  id varchar primary key default gen_random_uuid()::text, event_id varchar not null references public.events(id) on delete cascade,
  zone_id varchar not null references public.zones(id) on delete cascade, row text not null, seat text not null,
  price numeric(10,2) not null, seller_id varchar references public.users(id), status text not null default 'available',
  created_at timestamp not null default now());
create table public.orders (
  id varchar primary key default gen_random_uuid()::text, user_id varchar not null references public.users(id),
  ticket_id varchar not null references public.tickets(id), total_amount numeric(10,2) not null, fees numeric(10,2) not null,
  ticket_price numeric(10,2), fee_rate_used numeric(5,4), status text not null default 'pending', payment_method text,
  phone text, payment_reference text, expires_at timestamp, created_at timestamp not null default now());
create table public.otp_codes (
  id varchar primary key default gen_random_uuid()::text, phone text not null, code text not null,
  expires_at timestamp not null, used boolean not null default false, created_at timestamp not null default now());
create table public.config (
  id varchar primary key default gen_random_uuid()::text, key text not null unique, value json not null,
  updated_at timestamp not null default now());
alter table public.users enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.zones enable row level security;
alter table public.tickets enable row level security;
alter table public.orders enable row level security;
alter table public.otp_codes enable row level security;
alter table public.config enable row level security;

-- Fictitious rows mirroring the remote shape (1 admin user, 3 venues, 3 events).
insert into public.users (id, email, password, first_name, last_name, role)
values ('u-admin', 'admin@example.test', '$2b$10$fixturefixturefixturefixturefixturefixturefixtureXX', 'Admin', 'Fixture', 'admin');
insert into public.venues (id, name, city) values ('v1', 'Foro A', 'CDMX'), ('v2', 'Foro B', 'GDL'), ('v3', 'Foro C', 'MTY');
insert into public.events (id, title, category, date, venue_id) values
  ('e1', 'Evento 1', 'concierto', now() + interval '10 days', 'v1'),
  ('e2', 'Evento 2', 'deporte', now() + interval '20 days', 'v2'),
  ('e3', 'Evento 3', 'teatro', now() + interval '30 days', 'v3');
