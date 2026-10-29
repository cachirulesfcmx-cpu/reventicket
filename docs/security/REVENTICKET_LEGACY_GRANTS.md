# RevenTicket: privilegios de las tablas antiguas (hallazgo, sin corregir)

Auditoría de solo lectura del 2026-10-29 sobre el proyecto Supabase `reventicket` (`jxdyrzbeykhswpndoing`).
**No se modificó ninguna tabla, política ni flujo de RevenTicket.**

## Evidencia

| Comprobación | Resultado |
|---|---|
| Tablas afectadas | `config`, `events`, `orders`, `otp_codes`, `tickets`, `users`, `venues`, `zones` |
| Grants de tabla | `anon` y `authenticated` tienen **todos** los privilegios: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER (defecto de Supabase para tablas nuevas en `public`) |
| RLS | Activado en las 8 tablas |
| Políticas | **Ninguna** (`pg_policies` solo lista políticas de VANTA) → con RLS activo y sin políticas, PostgREST deniega todas las filas a `anon`/`authenticated` |
| Filas | Recuento exacto: 3 `events`, 3 `venues`, **1 `users`** (creados el 2026-05-08); resto vacías. La estimación inicial de `pg_stat_user_tables` (0) era incorrecta |
| Acceso de la app | `server/db.ts` (rama `main`) usa `pg` + Drizzle con `DATABASE_URL` (rol `postgres` del pooler, propietario de las tablas): no usa `supabase-js` ni la API REST, así que no depende de los grants de `anon`/`authenticated` |
| Tablas de `shared/schema.ts` ausentes en la BD | `carts`, `payment_reminders`, `order_events`, `idempotency_keys`, `job_locks`, `risk_events`, `risk_profiles`, `bans`, … (el esquema remoto está por detrás del código) |

## Riesgo

- **Hoy la protección depende exclusivamente de RLS sin políticas.** Basta con desactivar RLS en una tabla, o
  crear una política permisiva por error (p. ej. desde el panel), para que la clave pública `anon` pueda leer y
  escribir `users` (incluye hash de contraseña), `otp_codes`, `orders` y `tickets` vía `/rest/v1`.
- `TRUNCATE` no está sujeto a RLS. PostgREST no lo expone, pero el privilegio existe para cualquier vía SQL que
  se abriera en el futuro con esos roles (p. ej. una función `SECURITY INVOKER` expuesta por RPC).
- Severidad actual: **media** (sin políticas y app vía conexión directa, pero ya hay una cuenta real en `users`, con hash de contraseña). Severidad si cambia RLS: **crítica**.

## Recomendación (cambio futuro y separado, requiere autorización)

1. Confirmar en Vercel que `DATABASE_URL` de RevenTicket usa el rol `postgres` (no `anon`/`authenticated`).
2. En una migración propia de RevenTicket, revocar los privilegios de cliente que la app no usa:

   ```sql
   revoke all on public.config, public.events, public.orders, public.otp_codes,
                 public.tickets, public.users, public.venues, public.zones
     from anon, authenticated;
   ```

3. Mantener RLS activado sin políticas públicas; añadir `alter default privileges` solo si RevenTicket va a
   crear más tablas y nunca las expondrá por REST.
4. Probar antes en una rama de Supabase o en local (`supabase/tests/run-local.sh` como plantilla) y verificar
   compra, OTP y emisión de boletos con la app apuntando a esa base.
5. Rollback: `grant select, insert, update, delete, truncate, references, trigger on … to anon, authenticated;`
