-- VANTA EDGE · hardening after security audit (2026-10-28).
-- Additive and non-destructive: no table drops, no data deletion.

-- New columns first so the column-level grants below can reference them.
alter table public.model_versions add column if not exists approved_at timestamptz;
alter table public.model_versions add column if not exists approved_by text;
alter table public.model_versions add column if not exists validation_report_uri text;
alter table public.profiles add column if not exists adult_attested_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

-- ---------------------------------------------------------------------------
-- 1. Defense in depth: Supabase grants anon/authenticated ALL on new public tables.
--    RLS already blocks writes, but we also remove the privileges themselves.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.teams, public.games, public.game_facts, public.odds_snapshots,
  public.model_versions, public.predictions, public.followed_teams, public.user_preferences
  from anon, authenticated;

-- Canonical sports data: read-only, and provider raw payloads are NOT exposed (licensing).
grant select (id, provider, sport, name, short_name, logo_url, created_at) on public.teams to anon, authenticated;
grant select (id, provider, sport, competition, season, home_team_id, away_team_id, starts_at, status,
              home_score, away_score, data_quality, source_updated_at, updated_at) on public.games to anon, authenticated;
grant select (id, game_id, provider, fact_type, subject_id, value, quality, observed_at, valid_for) on public.game_facts to anon, authenticated;

-- Odds: redistribution usually requires a specific licence, so clients get no direct access.
drop policy if exists "Public read odds snapshots" on public.odds_snapshots;

-- Models / predictions: column grants exclude internal feature snapshots and artifact URIs.
grant select (id, sport, model_name, version, training_cutoff, validation_metrics, approved_for_publication, approved_at)
  on public.model_versions to anon, authenticated;
grant select (id, game_id, model_version_id, sport, market_key, selection_key, probability, decimal_odds,
              market_probability, edge, status, explanation, data_cutoff, published_at, settled_at, outcome, is_demo)
  on public.predictions to anon, authenticated;

-- User-owned data.
grant select, update (display_name, preferred_locale) on public.profiles to authenticated;
grant select, insert, delete on public.followed_teams to authenticated;
grant select, insert, update (locale, notifications_enabled, favorite_sports) on public.user_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Profiles are created server-side on signup with an 18+ attestation.
-- ---------------------------------------------------------------------------
drop policy if exists "Users insert own profile" on public.profiles;

create or replace function public.vanta_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- Only act on VANTA EDGE signups so other apps sharing this auth schema are unaffected.
  if meta ->> 'app' is distinct from 'vanta-edge' then
    return new;
  end if;
  if coalesce(meta ->> 'adult_attested', 'false') <> 'true' then
    raise exception 'VANTA_ADULT_ATTESTATION_REQUIRED' using errcode = 'P0001';
  end if;
  insert into public.profiles (id, display_name, adult_attested_at, terms_version)
  values (new.id, left(coalesce(meta ->> 'display_name', ''), 80), now(), left(coalesce(meta ->> 'terms_version', 'unknown'), 40))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists vanta_on_auth_user_created on auth.users;
create trigger vanta_on_auth_user_created after insert on auth.users
  for each row execute function public.vanta_handle_new_user();

-- Notifications require explicit opt-in.
alter table public.user_preferences alter column notifications_enabled set default false;

-- set_updated_at must not depend on the caller's search_path.
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Data provenance: every ingestion run records source, licence and freshness.
-- ---------------------------------------------------------------------------
create table if not exists public.data_sources (
  provider text primary key,
  display_name text not null,
  licence_reference text not null,
  commercial_use_confirmed boolean not null default false,
  allows_odds_display boolean not null default false,
  attribution text,
  created_at timestamptz not null default now()
);
alter table public.data_sources enable row level security;
revoke all on public.data_sources from anon, authenticated;
grant select (provider, display_name, attribution) on public.data_sources to anon, authenticated;
create policy "Public read data source attribution" on public.data_sources for select to anon, authenticated using (true);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  sport public.sport_code not null,
  run_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  records_upserted int not null default 0,
  error_code text,
  unique (provider, sport, run_key)
);
create index if not exists ingestion_runs_recent_idx on public.ingestion_runs (sport, started_at desc);
alter table public.ingestion_runs enable row level security;
revoke all on public.ingestion_runs from anon, authenticated;

-- Freshness per sport for status pages (aggregates only).
create or replace view public.data_freshness with (security_invoker = true) as
  select g.sport, max(g.source_updated_at) as last_source_update, count(*) as games
  from public.games g group by g.sport;
revoke all on public.data_freshness from anon, authenticated;
grant select on public.data_freshness to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Publication gate enforced in the database.
-- ---------------------------------------------------------------------------
alter table public.model_versions drop constraint if exists model_approval_evidence;
alter table public.model_versions add constraint model_approval_evidence check (
  not approved_for_publication or (approved_at is not null and approved_by is not null and validation_report_uri is not null)
);

drop policy if exists "Public read published predictions" on public.predictions;
create policy "Public read published predictions from approved models" on public.predictions
  for select to anon, authenticated
  using (
    status in ('published', 'settled') and is_demo = false
    and exists (select 1 from public.model_versions mv where mv.id = model_version_id and mv.approved_for_publication)
  );

create or replace function public.vanta_guard_predictions()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('published', 'settled') then
    if new.is_demo then
      raise exception 'VANTA_DEMO_CANNOT_PUBLISH' using errcode = 'P0001';
    end if;
    if new.model_version_id is null or not exists (
      select 1 from public.model_versions mv where mv.id = new.model_version_id and mv.approved_for_publication
    ) then
      raise exception 'VANTA_MODEL_NOT_APPROVED' using errcode = 'P0001';
    end if;
    if new.data_cutoff > coalesce(new.published_at, now()) then
      raise exception 'VANTA_DATA_CUTOFF_AFTER_PUBLICATION' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status in ('published', 'settled') then
    -- Published snapshots are immutable; only settlement fields may change.
    if (new.probability, new.decimal_odds, new.market_probability, new.edge, new.selection_key, new.market_key,
        new.feature_snapshot, new.explanation, new.data_cutoff, new.published_at, new.model_version_id, new.game_id)
       is distinct from
       (old.probability, old.decimal_odds, old.market_probability, old.edge, old.selection_key, old.market_key,
        old.feature_snapshot, old.explanation, old.data_cutoff, old.published_at, old.model_version_id, old.game_id) then
      raise exception 'VANTA_PUBLISHED_PREDICTION_IMMUTABLE' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists vanta_predictions_guard on public.predictions;
create trigger vanta_predictions_guard before insert or update on public.predictions
  for each row execute function public.vanta_guard_predictions();

create or replace function public.vanta_block_published_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('published', 'settled') then
    raise exception 'VANTA_PUBLISHED_PREDICTION_IMMUTABLE' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
drop trigger if exists vanta_predictions_no_delete on public.predictions;
create trigger vanta_predictions_no_delete before delete on public.predictions
  for each row execute function public.vanta_block_published_delete();

-- Audited performance of published picks (settled only, no demo).
create or replace view public.published_performance with (security_invoker = true) as
  select p.sport, mv.model_name, mv.version, count(*) as settled,
         avg(case when p.outcome then 1.0 else 0.0 end) as hit_rate,
         avg(power(p.probability - case when p.outcome then 1 else 0 end, 2)) as brier
  from public.predictions p join public.model_versions mv on mv.id = p.model_version_id
  where p.status = 'settled' and p.outcome is not null and not p.is_demo
  group by p.sport, mv.model_name, mv.version;
revoke all on public.published_performance from anon, authenticated;
grant select on public.published_performance to anon, authenticated;

-- Helpful indexes for RLS joins and feeds.
create index if not exists predictions_model_version_idx on public.predictions (model_version_id);
create index if not exists followed_teams_team_idx on public.followed_teams (team_id);
create index if not exists games_home_team_idx on public.games (home_team_id);
create index if not exists games_away_team_idx on public.games (away_team_id);

revoke all on function public.vanta_handle_new_user() from public, anon, authenticated;
revoke all on function public.vanta_guard_predictions() from public, anon, authenticated;
revoke all on function public.vanta_block_published_delete() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
