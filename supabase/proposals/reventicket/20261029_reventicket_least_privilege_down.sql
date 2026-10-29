-- RevenTicket · rollback of 20261029_reventicket_least_privilege.sql (PROPOSAL — not applied).
-- Restores ONLY the privileges that migration recorded as revoked and that are still missing.
-- It never grants anything that was not recorded, never revokes anything, and skips tables
-- that no longer exist. Run as the same owner role (Supabase: postgres).

do $rollback$
declare
  r record;
  restored int := 0;
begin
  if to_regclass('reventicket_audit.revoked_privileges') is null then
    raise exception 'RT_ROLLBACK: no record of the least-privilege migration; nothing to restore';
  end if;

  for r in
    select id, object_name, grantee, privilege
    from reventicket_audit.revoked_privileges
    where kind = 'table' and restored_at is null
    order by id
  loop
    if to_regclass('public.' || quote_ident(r.object_name)) is not null
       and not has_table_privilege(r.grantee, 'public.' || quote_ident(r.object_name), r.privilege) then
      execute format('grant %s on table public.%I to %I', r.privilege, r.object_name, r.grantee);
    end if;
    update reventicket_audit.revoked_privileges set restored_at = now() where id = r.id;
    restored := restored + 1;
  end loop;

  for r in
    select id, object_name, grantee, privilege
    from reventicket_audit.revoked_privileges
    where kind = 'default' and restored_at is null
    order by id
  loop
    execute format('alter default privileges in schema public grant %s on %s to %I',
                   r.privilege, case r.object_name when 'r' then 'tables' when 'S' then 'sequences' end, r.grantee);
    update reventicket_audit.revoked_privileges set restored_at = now() where id = r.id;
    restored := restored + 1;
  end loop;

  raise notice 'RT_ROLLBACK: % recorded privileges restored', restored;
end
$rollback$;
-- The bookkeeping table is kept as an audit trail (restored_at is set on every row).
