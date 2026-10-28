-- Reverses 202610280001_hardening.sql, restoring the exact post-initial-schema state.
-- Run only with explicit approval. It REMOVES protections (publication gate, immutability,
-- column grants); prefer a forward fix. data_sources / ingestion_runs are dropped only if empty.
begin;
drop trigger if exists vanta_on_auth_user_created on auth.users;
drop trigger if exists vanta_predictions_guard on public.predictions;
drop trigger if exists vanta_predictions_no_delete on public.predictions;
drop function if exists public.vanta_handle_new_user();
drop function if exists public.vanta_guard_predictions();
drop function if exists public.vanta_block_published_delete();
drop view if exists public.published_performance;
drop view if exists public.data_freshness;
do $$ begin
  if not exists (select 1 from public.ingestion_runs) then drop table public.ingestion_runs; end if;
  if not exists (select 1 from public.data_sources) then drop table public.data_sources; end if;
end $$;
drop policy if exists "Public read published predictions from approved models" on public.predictions;
create policy "Public read published predictions" on public.predictions for select to anon, authenticated using (status = 'published' and is_demo = false);
create policy "Public read odds snapshots" on public.odds_snapshots for select to anon, authenticated using (true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
alter table public.model_versions drop constraint if exists model_approval_evidence;
alter table public.user_preferences alter column notifications_enabled set default true;
drop index if exists public.predictions_model_version_idx;
drop index if exists public.followed_teams_team_idx;
drop index if exists public.games_home_team_idx;
drop index if exists public.games_away_team_idx;
-- Restore Supabase default table privileges.
grant all on public.profiles, public.teams, public.games, public.game_facts, public.odds_snapshots,
  public.model_versions, public.predictions, public.followed_teams, public.user_preferences to anon, authenticated;
-- Added columns are kept (dropping them would lose approval/attestation evidence).
delete from supabase_migrations.schema_migrations where name = 'vanta_hardening';
commit;
