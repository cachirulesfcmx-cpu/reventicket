-- RevenTicket least-privilege regression suite. Runs as rt_owner (stand-in for Supabase `postgres`)
-- AFTER the migration. Every assertion raises on failure; each success prints "ok - ...".
-- Backend flows run inside a transaction that is rolled back, so existing data is untouched.
create schema rt_test;
grant usage on schema rt_test to anon, authenticated;
create function rt_test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function rt_test.throws(sql text, pattern text, msg text) returns void language plpgsql as $$
begin
  begin execute sql;
  exception when others then
    if sqlerrm ~* pattern then raise notice 'ok - %', msg; return; end if;
    raise exception 'ASSERTION FAILED: % (unexpected error: %)', msg, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: % (statement succeeded)', msg;
end $$;
grant execute on all functions in schema rt_test to anon, authenticated;

-- ------------------------------------------------------------ privilege matrix (16 assertions)
do $$
declare
  t text; r text;
  privs constant text := 'select,insert,update,delete,truncate,references,trigger'
    || case when current_setting('server_version_num')::int >= 170000 then ',maintain' else '' end;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach t in array array['config','events','orders','otp_codes','tickets','users','venues','zones'] loop
      perform rt_test.ok(not has_table_privilege(r, 'public.' || t, privs),
                         r || ' holds no privilege on ' || t);
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------ anonymous visitor (public API key)
set role anon;
select rt_test.throws('select password from public.users', 'permission denied', 'anon cannot read password hashes');
select rt_test.throws('select code from public.otp_codes', 'permission denied', 'anon cannot read OTP codes');
select rt_test.throws('select * from public.orders', 'permission denied', 'anon cannot read orders');
select rt_test.throws('select * from public.tickets', 'permission denied', 'anon cannot read tickets');
select rt_test.throws('select * from public.config', 'permission denied', 'anon cannot read config');
select rt_test.throws($q$insert into public.otp_codes (phone, code, expires_at) values ('5500000000', '000000', now() + interval '5 min')$q$,
  'permission denied', 'anon cannot plant OTP codes');
select rt_test.throws($q$insert into public.users (email, password, first_name, last_name, role) values ('x@x.test', 'x', 'x', 'x', 'admin')$q$,
  'permission denied', 'anon cannot create (admin) users');
select rt_test.throws('truncate public.orders', 'permission denied', 'anon cannot truncate orders (TRUNCATE ignores RLS)');
reset role;

-- ------------------------------------------------------------ authenticated (any Supabase Auth JWT)
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);
set role authenticated;
select rt_test.throws($q$update public.users set role = 'admin'$q$, 'permission denied', 'authenticated cannot escalate roles');
select rt_test.throws('select * from public.orders', 'permission denied', 'authenticated cannot read other people''s orders');
select rt_test.throws('delete from public.tickets', 'permission denied', 'authenticated cannot delete tickets');
select rt_test.throws($q$update public.otp_codes set used = false$q$, 'permission denied', 'authenticated cannot reuse OTP codes');
select rt_test.throws($q$insert into public.config (key, value) values ('fees', '{"rate":0}')$q$, 'permission denied', 'authenticated cannot change config');
reset role;

-- ------------------------------------------------------------ defence in depth: no longer depends on RLS alone
begin;
alter table public.users disable row level security;
set local role anon;
select rt_test.throws('select email, password from public.users', 'permission denied',
  'even with RLS disabled by mistake, anon cannot read users');
rollback;

-- ------------------------------------------------------------ structure preserved
select rt_test.ok((select bool_and(relrowsecurity) from pg_class where oid = any(array[
  'public.config','public.events','public.orders','public.otp_codes','public.tickets','public.users','public.venues','public.zones']::regclass[])),
  'RLS still enabled on all 8 legacy tables');
select rt_test.ok((select count(*) from pg_policies where tablename in ('config','events','orders','otp_codes','tickets','users','venues','zones')) = 0,
  'no permissive policy was added');
select rt_test.ok(has_table_privilege('service_role', 'public.orders', 'select,insert,update,delete'),
  'service_role privileges untouched (server-only key)');
select rt_test.ok(not has_schema_privilege('anon', 'reventicket_audit', 'usage') and not has_schema_privilege('authenticated', 'reventicket_audit', 'usage'),
  'audit schema is not reachable by client roles');

-- ------------------------------------------------------------ backend flows (Drizzle via DATABASE_URL = owner role)
begin;
-- registration + login lookup (server/storage.ts createUser / getUserByEmail)
insert into public.users (id, email, password, first_name, last_name) values ('u-buyer', 'buyer@example.test', '$2b$10$hash', 'Ana', 'Compradora');
select rt_test.ok((select count(*) from public.users where email = 'buyer@example.test') = 1, 'backend: register and look up user by email');
-- password recovery / OTP (createOtp / getValidOtp / markOtpUsed)
insert into public.otp_codes (id, phone, code, expires_at) values ('o1', '5512345678', '123456', now() + interval '5 min');
select rt_test.ok((select count(*) from public.otp_codes where phone = '5512345678' and code = '123456' and not used and expires_at > now()) = 1,
  'backend: issue and validate OTP');
update public.otp_codes set used = true where id = 'o1';
select rt_test.ok((select used from public.otp_codes where id = 'o1'), 'backend: mark OTP as used');
-- admin catalogue (requireAdmin routes: venues, events, zones, tickets, config)
insert into public.venues (id, name, city) values ('v-t', 'Foro Test', 'CDMX');
insert into public.events (id, title, category, date, venue_id) values ('e-t', 'Evento Test', 'concierto', now() + interval '5 days', 'v-t');
insert into public.zones (id, event_id, name, base_price) values ('z-t', 'e-t', 'General', 500);
insert into public.tickets (id, event_id, zone_id, row, seat, price) values ('t-t', 'e-t', 'z-t', 'A', '1', 500);
update public.events set min_price = 500 where id = 'e-t';
insert into public.config (key, value) values ('test_flag', '{"on":true}')
  on conflict (key) do update set value = excluded.value, updated_at = now();
select rt_test.ok((select count(*) from public.events e join public.venues v on v.id = e.venue_id join public.zones z on z.event_id = e.id where e.id = 'e-t') = 1,
  'backend: admin creates venue, event, zone and ticket; catalogue join works');
-- purchase + issuance (createOrder / updateTicketStatus / updateOrderStatus)
insert into public.orders (id, user_id, ticket_id, total_amount, fees, status, expires_at)
  values ('ord-t', 'u-buyer', 't-t', 550, 50, 'pending', now() + interval '15 min');
update public.tickets set status = 'reserved' where id = 't-t';
update public.orders set status = 'paid', payment_reference = 'ref-test' where id = 'ord-t';
update public.tickets set status = 'sold' where id = 't-t';
select rt_test.ok((select o.status = 'paid' and t.status = 'sold' from public.orders o join public.tickets t on t.id = o.ticket_id where o.id = 'ord-t'),
  'backend: order paid and ticket issued');
select rt_test.ok((select count(*) from public.orders where user_id = 'u-buyer') = 1, 'backend: buyer wallet lists own orders');
-- admin delete with cascade (deleteEvent)
delete from public.orders where id = 'ord-t';
delete from public.events where id = 'e-t';
select rt_test.ok((select count(*) from public.zones where id = 'z-t') + (select count(*) from public.tickets where id = 't-t') = 0,
  'backend: deleting an event cascades to zones and tickets');
-- runtime-created tables (connect-pg-simple `session`, migrate-new-tables.ts)
create table public.session (sid varchar primary key, sess json not null, expire timestamp(6) not null);
create table public.discount_codes (id serial primary key, code text unique not null);
select rt_test.ok(not has_table_privilege('anon', 'public.session', 'select,insert,update,delete')
              and not has_table_privilege('authenticated', 'public.session', 'select,insert,update,delete'),
  'new runtime table `session` is not exposed to client roles');
select rt_test.ok(not has_table_privilege('anon', 'public.discount_codes', 'select')
              and not has_sequence_privilege('anon', 'public.discount_codes_id_seq', 'usage'),
  'new runtime tables and sequences are private by default');
select rt_test.ok(has_table_privilege('service_role', 'public.session', 'select'),
  'service_role still receives default grants on new tables');
-- push-notifications.ts ensurePushTable(): holds push endpoint secrets (p256dh, auth)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id varchar references public.users(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null, role text not null default 'admin',
  created_at timestamptz not null default now());
-- migrate-new-tables.ts
create table if not exists public.event_maps (
  id varchar primary key default gen_random_uuid(), event_id varchar not null references public.events(id) on delete cascade,
  name text not null, svg_data text, image_url text, sections json default '[]', created_at timestamp not null default now(),
  updated_at timestamp not null default now());
-- drizzle-kit push of a shared/schema.ts table missing remotely (e.g. carts)
create table public.carts (id varchar primary key default gen_random_uuid(), session_id text, items json, created_at timestamp default now());
select rt_test.ok(not has_table_privilege('anon', 'public.push_subscriptions', 'select')
              and not has_table_privilege('authenticated', 'public.push_subscriptions', 'select'),
  'new runtime table `push_subscriptions` (push secrets) is not exposed');
select rt_test.ok(not has_table_privilege('anon', 'public.event_maps', 'select,insert'), 'new runtime table `event_maps` is not exposed');
select rt_test.ok(not has_table_privilege('anon', 'public.carts', 'select,insert'), 'tables created by drizzle-kit push are not exposed');
insert into public.session (sid, sess, expire) values ('s1', '{"userId":"u-buyer"}', now() + interval '1 day');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('u-admin', 'https://push.example.test/1', 'k', 'a');
insert into public.event_maps (event_id, name) values ('e1', 'Mapa');
select rt_test.ok((select count(*) from public.session) + (select count(*) from public.push_subscriptions) + (select count(*) from public.event_maps) = 3,
  'backend keeps full access to the tables it creates at runtime');
rollback;

drop schema rt_test cascade;
