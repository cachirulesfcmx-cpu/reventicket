-- RevenTicket · Plan B rollback (PROPOSAL — not applied).
-- Restores the 8 tables recorded in reventicket_audit.schema_move to `public` with their ORIGINAL owner, ACL,
-- constraint and column names, keeping every row. Run as `postgres` with the app stopped, and point DATABASE_URL
-- back at the previous role before restarting the old app version.
--
-- What it does not undo (by design, documented): tables created later in `reventicket` (e.g. by drizzle-kit push or
-- at runtime) and the `session` table stay in schema `reventicket`; the reventicket_app role is kept. Values written
-- to `events.is_featured` after the move are lost when the column that the move added is dropped.
-- ONE `DO` statement: atomic under any client.
do $rollback$
declare
  r record;
  k text;
  g record;
begin
  if to_regclass('reventicket_audit.schema_move') is null
     or not exists (select 1 from reventicket_audit.schema_move where rolled_back_at is null) then
    raise exception 'RT_MOVE_DOWN: no active move recorded; nothing to restore';
  end if;
  -- Temporary membership: the schema is private to reventicket_app (no USAGE for anyone else) and ownership must be
  -- taken back (PostgreSQL 16+ role semantics). Revoked at the end; any failure rolls the whole statement back.
  execute format('grant reventicket_app to %I', current_user);

  for r in select * from reventicket_audit.schema_move where rolled_back_at is null loop
    if to_regclass('public.' || quote_ident(r.table_name)) is not null then
      raise exception 'RT_MOVE_DOWN: public.% exists again; resolve manually', r.table_name;
    end if;
    if to_regclass('reventicket.' || quote_ident(r.table_name)) is null then
      raise exception 'RT_MOVE_DOWN: reventicket.% not found', r.table_name;
    end if;
  end loop;

  for r in select * from reventicket_audit.schema_move where rolled_back_at is null order by table_name loop
    for k in select jsonb_object_keys(r.renamed_constraints) loop
      execute format('alter table reventicket.%I rename constraint %I to %I', r.table_name, k, r.renamed_constraints ->> k);
    end loop;
    for k in select jsonb_object_keys(r.renamed_columns) loop
      execute format('alter table reventicket.%I rename column %I to %I', r.table_name, k, r.renamed_columns ->> k);
    end loop;
    foreach k in array r.added_columns loop
      execute format('alter table reventicket.%I drop column %I', r.table_name, k);
    end loop;
    execute format('alter table reventicket.%I set schema public', r.table_name);
    execute format('alter table public.%I owner to %I', r.table_name, r.original_owner);
    -- Restore the original ACL entries (owner's own entry is implicit).
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', r.table_name);
    for g in select pg_get_userbyid(a.grantee) as grantee, a.grantee = 0 as is_public, a.privilege_type
             from aclexplode(coalesce(r.original_acl, '{}'::aclitem[])) a
             where a.grantee <> (select oid from pg_roles where rolname = r.original_owner) loop
      execute format('grant %s on table public.%I to %s', g.privilege_type, r.table_name,
                     case when g.is_public then 'public' else quote_ident(g.grantee) end);
    end loop;
    update reventicket_audit.schema_move set rolled_back_at = now() where table_name = r.table_name;
  end loop;

  execute format('revoke reventicket_app from %I', current_user);

  -- Postcondition: ACLs equal to the recorded originals (as sets of grantee/privilege).
  for r in select * from reventicket_audit.schema_move where rolled_back_at is not null loop
    if exists (
      (select a.grantee, a.privilege_type from pg_class c, aclexplode(c.relacl) a
        where c.oid = ('public.' || quote_ident(r.table_name))::regclass)
      except
      (select a.grantee, a.privilege_type from aclexplode(coalesce(r.original_acl, '{}'::aclitem[])) a)
    ) or exists (
      (select a.grantee, a.privilege_type from aclexplode(coalesce(r.original_acl, '{}'::aclitem[])) a)
      except
      (select a.grantee, a.privilege_type from pg_class c, aclexplode(c.relacl) a
        where c.oid = ('public.' || quote_ident(r.table_name))::regclass)
    ) then
      raise exception 'RT_MOVE_DOWN_POST: ACL of public.% differs from the recorded original', r.table_name;
    end if;
  end loop;
  raise notice 'RT_MOVE_ROLLED_BACK: tables restored to public with original owner, ACL and names';
end
$rollback$;
