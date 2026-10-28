-- VANTA EDGE initial schema. Apply via Supabase CLI or SQL editor.
create extension if not exists pgcrypto;
create type public.sport_code as enum ('LIGA_MX','UCL','LALIGA','NFL','MLB','NBA');
create type public.event_status as enum ('scheduled','live','final','postponed','cancelled');
create type public.data_quality as enum ('confirmed','provisional','stale','missing');
create type public.prediction_status as enum ('draft','published','settled','void');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  preferred_locale text not null default 'es-MX',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_team_id text not null,
  sport public.sport_code not null,
  name text not null,
  short_name text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  unique(provider, provider_team_id, sport)
);
create table public.games (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  sport public.sport_code not null,
  competition text not null,
  season text,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  starts_at timestamptz not null,
  status public.event_status not null default 'scheduled',
  home_score integer,
  away_score integer,
  data_quality public.data_quality not null default 'provisional',
  source_updated_at timestamptz,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_event_id),
  check (home_team_id <> away_team_id)
);
create index games_sport_start_idx on public.games(sport, starts_at);
create index games_status_start_idx on public.games(status, starts_at);
create table public.game_facts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  provider text not null,
  fact_type text not null,
  subject_id text,
  value jsonb not null,
  quality public.data_quality not null default 'provisional',
  observed_at timestamptz not null,
  valid_for timestamptz,
  created_at timestamptz not null default now()
);
create index game_facts_lookup_idx on public.game_facts(game_id, fact_type, observed_at desc);
create table public.odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  provider text not null,
  bookmaker text not null,
  market_key text not null,
  selection_key text not null,
  decimal_odds numeric(10,4) not null check (decimal_odds > 1),
  line_value numeric(10,3),
  captured_at timestamptz not null,
  raw_metadata jsonb not null default '{}'::jsonb
);
create index odds_snapshots_game_market_time_idx on public.odds_snapshots(game_id, market_key, captured_at desc);
create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  sport public.sport_code not null,
  model_name text not null,
  version text not null,
  artifact_uri text,
  training_cutoff timestamptz not null,
  validation_metrics jsonb not null default '{}'::jsonb,
  approved_for_publication boolean not null default false,
  created_at timestamptz not null default now(),
  unique(sport, model_name, version)
);
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  model_version_id uuid references public.model_versions(id),
  sport public.sport_code not null,
  market_key text not null,
  selection_key text not null,
  probability numeric(7,6) not null check (probability >= 0 and probability <= 1),
  decimal_odds numeric(10,4) check (decimal_odds is null or decimal_odds > 1),
  market_probability numeric(7,6) check (market_probability is null or (market_probability >= 0 and market_probability <= 1)),
  edge numeric(7,6),
  status public.prediction_status not null default 'draft',
  explanation jsonb not null default '{}'::jsonb,
  feature_snapshot jsonb not null default '{}'::jsonb,
  data_cutoff timestamptz not null,
  published_at timestamptz,
  settled_at timestamptz,
  outcome boolean,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index predictions_public_feed_idx on public.predictions(status, published_at desc) where status = 'published';
create index predictions_game_idx on public.predictions(game_id, created_at desc);
-- User-created watchlists are private. Public sports data is read-only to clients.
create table public.followed_teams (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, team_id)
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'es-MX',
  notifications_enabled boolean not null default true,
  favorite_sports public.sport_code[] not null default '{}',
  updated_at timestamptz not null default now()
);
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger games_updated_at before update on public.games for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.games enable row level security;
alter table public.game_facts enable row level security;
alter table public.odds_snapshots enable row level security;
alter table public.model_versions enable row level security;
alter table public.predictions enable row level security;
alter table public.followed_teams enable row level security;
alter table public.user_preferences enable row level security;
create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Public read teams" on public.teams for select to anon, authenticated using (true);
create policy "Public read games" on public.games for select to anon, authenticated using (true);
create policy "Public read game facts" on public.game_facts for select to anon, authenticated using (true);
create policy "Public read odds snapshots" on public.odds_snapshots for select to anon, authenticated using (true);
create policy "Public read approved model versions" on public.model_versions for select to anon, authenticated using (approved_for_publication = true);
create policy "Public read published predictions" on public.predictions for select to anon, authenticated using (status = 'published' and is_demo = false);
create policy "Users manage own followed teams" on public.followed_teams for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own preferences" on public.user_preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No client write policies for canonical sports data, odds, model versions, or predictions.
