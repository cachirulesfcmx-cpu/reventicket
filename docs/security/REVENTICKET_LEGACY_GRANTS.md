# RevenTicket: permisos de las tablas antiguas — auditoría y plan de corrección

Estado: **PLAN PARA REVISIÓN — no aplicado.** Auditoría de solo lectura del 2026-10-29 sobre el proyecto Supabase
`reventicket` (`jxdyrzbeykhswpndoing`, PostgreSQL 17.6). No se escribió en la base de datos, no se tocó MelatePro,
VANTA EDGE ni la rama `main`. No se leyeron hashes, OTP, tokens ni datos personales (solo estructura, privilegios y recuentos).

## 1. Auditoría (fase 1)

### Cómo accede la aplicación

| Pregunta | Evidencia | Conclusión |
|---|---|---|
| ¿REST de Supabase / `supabase-js`? | `git grep` en `main` (commit `1903f11`): ni `@supabase/*`, ni `/rest/v1`, ni `createClient` | **No.** La clave `anon` no interviene en RevenTicket |
| ¿Conexión directa? | `server/db.ts`: `pg.Pool({ connectionString: DATABASE_URL })` + Drizzle; `.env.example` apunta al pooler con usuario `postgres.<ref>` | **Sí**, rol `postgres` |
| Rol `postgres` en Supabase | `rolcanlogin=t`, `rolbypassrls=t`, `rolsuper=f`; dueño de las 8 tablas | Su acceso no depende de los grants a `anon`/`authenticated` ni de RLS |
| Sesiones | `server/routes.ts`: `connect-pg-simple` con `createTableIfMissing: true` (tabla `session`) | Crea tablas **sin RLS** en tiempo de ejecución |
| Tablas creadas en ejecución | `server/migrate-new-tables.ts`: `discount_codes`, `event_maps` | Mismo patrón: heredan los privilegios por defecto |
| Control administrativo | `requireAdmin` en el backend (`users.role = 'admin'`) para venues, events, zones, tickets, config, push | La autorización vive en el servidor, no en la base |
| ¿Está la app usando esta base hoy? | Sin conexiones de la app (solo PostgREST, pgbouncer, mgmt-api, supabase_admin); 0 inserciones/actualizaciones desde el último arranque; no existe la tabla `session` que la app crea al iniciar; faltan tablas de `shared/schema.ts` (`carts`, `payment_reminders`, …) | **Probablemente no**: el backend en producción parece usar otra base. **Debe confirmarse** (ver §7) |

### Operaciones por tabla (`server/storage.ts` + `server/seed.ts`, todas vía `DATABASE_URL`)

| Tabla | Lectura | Inserción | Actualización | Borrado | Funciones |
|---|---|---|---|---|---|
| `users` | sí | sí (registro, seed) | — | — | `getUser`, `getUserByEmail`, `createUser` |
| `otp_codes` | sí | sí | sí (marcar usado) | — | `createOtpCode`, `getValidOtpCode`, `markOtpVerified` |
| `orders` | sí | sí | sí (estado, teléfono) | — | `createOrder`, `updateOrderStatus`, `atomicConfirmPayment`, `getOrdersByUser`, … |
| `tickets` | sí | sí (admin) | sí (reserva/venta/expiración) | (cascada) | `atomicPurchase*`, `updateTicketStatus`, `expireReservedTickets*` |
| `events` | sí | sí (admin) | sí (admin) | sí (admin, cascada) | `createEvent`, `updateEvent`, `deleteEvent` |
| `venues` | sí | sí (admin) | sí (admin) | — | `createVenue`, `updateVenue` |
| `zones` | sí | sí (admin) | — | (cascada) | `createZone`, `getZonesByEvent` |
| `config` | sí | sí (admin) | sí (admin) | — | `getConfig`, `setConfig` |

Ninguna operación necesita a `anon` ni a `authenticated`: **todas** las ejecuta el backend como dueño.

### Base de datos

| Elemento | Estado |
|---|---|
| Privilegios de tabla | `anon` y `authenticated`: `arwdDxtm` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) en las 8 tablas; `service_role` igual |
| Privilegios por columna | Ninguno |
| RLS | Activado en las 8; `FORCE RLS` desactivado (el dueño la omite) |
| Políticas | **0** en las 8 tablas → hoy PostgREST devuelve 0 filas, pero **la única barrera es RLS** |
| Funciones / vistas / triggers sobre estas tablas | Ninguno. La única función `SECURITY DEFINER` de `public` es `vanta_handle_new_user` (VANTA, acotada a `app=vanta-edge`, sin EXECUTE para clientes) |
| Secuencias | Ninguna (ids `varchar` con `gen_random_uuid()`) |
| Privilegios por defecto de `postgres` en `public` | Tablas: ALL a `anon`/`authenticated`; secuencias: `rwU`; funciones: EXECUTE |
| Event triggers | Solo los de la plataforma (PostgREST, pg_graphql, pg_cron, pg_net) |
| Filas existentes | 1 `users`, 3 `events`, 3 `venues` (2026-05-08); resto vacías; md5 de ids `a260950f…4249` |

### Riesgo

- La clave `anon` es pública por diseño (VANTA la usa en el navegador) y PostgREST expone `public`. Si alguien
  desactiva RLS o añade una política permisiva, **cualquiera** puede leer/escribir `users` (hash de contraseña),
  `otp_codes`, `orders` y `tickets`. Demostrado en local: con RLS desactivado, `anon` lee la fila del usuario.
- `TRUNCATE` y `MAINTAIN` no están sujetos a RLS.
- Si el backend se conecta a esta base, creará `session`, `discount_codes` y `event_maps` **sin RLS y con todos
  los privilegios para `anon`** → sesiones legibles vía REST.
- Severidad actual: **media**. Si cambia RLS o la app arranca contra esta base: **crítica**.

## 2. Diseño del cambio (fase 2)

Archivos (fuera de `supabase/migrations/` para que nada lo aplique por accidente):

- `supabase/proposals/reventicket/20261029_reventicket_least_privilege.sql` — migración propuesta
- `supabase/proposals/reventicket/20261029_reventicket_least_privilege_down.sql` — reversión
- `supabase/proposals/reventicket/verify_remote.sql` — verificación de solo lectura (antes/después)
- `supabase/proposals/reventicket/test/` — prueba local completa (`run.sh`)

Principios: mínimo privilegio, sin políticas nuevas (no hay necesidad funcional: los clientes no acceden a estas
tablas), RLS se mantiene, `service_role` intacto (clave solo de servidor), ningún dato se modifica.

### Matriz de permisos

| Rol | Antes (8 tablas) | Después (8 tablas) | Tablas nuevas de `postgres` en `public` (antes → después) |
|---|---|---|---|
| `anon` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | **ninguno** | ALL → **ninguno** (secuencias `rwU` → ninguno) |
| `authenticated` | igual que `anon` | **ninguno** | ALL → **ninguno** (secuencias `rwU` → ninguno) |
| `service_role` | ALL (BYPASSRLS) | sin cambios | sin cambios |
| `postgres` (backend, dueño) | ALL (BYPASSRLS) | sin cambios | sin cambios |
| RLS | activado, 0 políticas | activado, 0 políticas | — |

**Se revocan exactamente** 128 privilegios de tabla (8 tablas × 2 roles × 8) y 22 privilegios por defecto
(tablas: 8 × 2; secuencias: 3 × 2). Los privilegios por defecto sobre **funciones** no se tocan (fuera de alcance;
PostgreSQL concede EXECUTE a `PUBLIC` igualmente).

### Salvaguardas de la migración

- **Precondiciones** (aborta sin cambios): las 8 tablas existen, quien ejecuta es su dueño, RLS activado, sin
  políticas nuevas desde la auditoría, y no hay una aplicación previa activa.
- **Instantánea**: cada privilegio retirado se guarda en `reventicket_audit.revoked_privileges` (esquema no expuesto,
  sin acceso de clientes) antes de revocarlo.
- **Postcondiciones** (aborta y revierte todo): ningún privilegio de cliente restante y RLS activado.
- Todo en una transacción (`apply_migration` o una sola ejecución en el SQL Editor).

### Impacto esperado por flujo

| Flujo | Rol que lo ejecuta | Impacto |
|---|---|---|
| Registro / login / JWT / sesión | backend (`postgres`) | Ninguno |
| OTP: envío, verificación, recuperación | backend | Ninguno |
| Compra (`atomicPurchase*`, reservas, `FOR UPDATE`) y confirmación de pago | backend | Ninguno |
| Emisión de boletos / wallet / escáner | backend | Ninguno |
| Panel admin (venues, events, zones, tickets, config, push) | backend + `requireAdmin` | Ninguno |
| Tablas creadas al arrancar (`session`, `discount_codes`, `event_maps`) | backend (dueño) | Se crean igual; **ya no** quedan expuestas a `anon` |
| Acceso vía REST con la clave `anon` a estas tablas | cliente | **Bloqueado** (hoy ya devuelve 0 filas por RLS) |
| VANTA EDGE | — | Ninguno (sus migraciones conceden permisos explícitos) |
| Futuras migraciones de VANTA que creen tablas | — | Deben conceder permisos explícitos (ya es la práctica) |

## 3. Pruebas (fase 4) — resultado local

`bash supabase/proposals/reventicket/test/run.sh` (PostgreSQL **16.15 y 17.11**; el remoto es 17.6). Usa un rol
`rt_owner` que replica a `postgres` de Supabase (dueño, sin superusuario, BYPASSRLS, privilegios por defecto a los
clientes), las 8 tablas con su estructura real y filas ficticias, y las migraciones de VANTA.

| Bloque | Resultado |
|---|---|
| Línea base: `anon` tiene SELECT en `users`; con RLS desactivado lee la fila (riesgo confirmado) | PASS |
| Precondición: ejecutar con un rol que no es dueño se rechaza y no cambia nada | PASS |
| Migración aplicada en una transacción; instantánea de 128 + 22 privilegios (PG17) | PASS |
| Suite de regresión: **44/44** — matriz 16 roles×tablas; anon no lee hashes/OTP/órdenes/boletos/config ni crea OTP/usuarios ni hace TRUNCATE; authenticated no escala roles, no lee órdenes ajenas, no borra boletos, no reutiliza OTP, no cambia config; con RLS desactivado por error, anon sigue sin leer `users`; RLS y 0 políticas intactos; `service_role` intacto; esquema de auditoría inaccesible; backend: registro + login, OTP emitir/validar/usar, alta admin de venue/evento/zona/boleto, compra pagada y boleto emitido, wallet, borrado en cascada; `session`/`discount_codes` nuevas privadas por defecto | PASS |
| Datos existentes sin cambios (md5 de todas las filas) | PASS |
| VANTA: triggers, políticas y permisos idénticos; su suite de 41 aserciones sigue pasando | PASS |
| Rollback: ACL y privilegios por defecto idénticos al original; datos intactos; idempotente | PASS |
| Rollback no concede nada sobre objetos posteriores ni deshace cambios posteriores no relacionados | PASS |
| `verify_remote.sql` funciona y no muestra acceso de clientes tras aplicar | PASS |

**No cubierto en local:** el arranque real del servidor de RevenTicket contra una base de prueba (registro, OTP por
WhatsApp, pago). Se propone como prueba de humo en la fase 5 si el backend usa esta base.

Estado remoto **antes** (lectura, 2026-10-29, `verify_remote.sql`): anon/authenticated con privilegios en las 8,
RLS en las 8, 0 políticas, recuentos 1/3/3/0/0/0/0/0, md5 de ids `a260950f…4249`, 22 privilegios por defecto de
tablas/secuencias + 2 de funciones, VANTA con 3 triggers y 10 políticas.

## 4. Recuperación

1. Si la migración falla, PostgreSQL revierte la transacción completa (pre/postcondiciones incluidas).
2. Si tras aplicarla algo deja de funcionar: ejecutar `20261029_reventicket_least_privilege_down.sql` como
   `postgres`. Restaura **solo** los privilegios registrados que falten, en tablas que aún existan; no revoca nada,
   no concede nada no registrado, es idempotente y deja `restored_at` como rastro de auditoría.
3. Verificar con `verify_remote.sql` (debe volver a la línea base de §3).
4. No requiere restaurar datos: la migración no los modifica.

## 5. Riesgos y requisitos de aprobación

| Riesgo | Mitigación |
|---|---|
| El backend de producción usa esta base con un rol distinto de `postgres` | Confirmar antes (ver §7). La migración no afecta a `postgres` ni a `service_role` |
| Alguna herramienta externa usa la clave `anon`/JWT contra estas tablas | No hay rastro en el código; hoy ya obtendría 0 filas por RLS |
| Futuras tablas creadas por `postgres` en `public` ya no serán accesibles por REST sin GRANT explícito | Intencionado; documentado. VANTA ya concede explícitamente |
| Tablas creadas por `supabase_admin` (p. ej. algunas del panel) | Sus privilegios por defecto no cambian (requeriría otro rol); se recomienda revisar las tablas nuevas tras crearlas |

Para aplicar se necesita: (1) **tu aprobación expresa del plan**; (2) confirmación de qué base y rol usa el backend
de RevenTicket en producción; (3) aceptar la confirmación interactiva de Supabase (o ejecutarlo tú en el SQL Editor).

## 6. Fase 5 (solo tras aprobación)

1. `run.sh` en verde en el commit a aplicar (hecho para este plan).
2. Línea base remota con `verify_remote.sql`.
3. Aplicar la migración como `postgres` (MCP `apply_migration` con confirmación, o SQL Editor en una sola ejecución).
4. `verify_remote.sql`: 0 privilegios de cliente, RLS activo, 0 políticas, recuentos y md5 idénticos, VANTA intacto.
5. Re-ejecutar `supabase/tests/remote_verify.sql` (VANTA, 41/41).
6. Si el backend usa esta base: prueba de humo de registro, login, OTP, compra y panel admin.
7. Documentar resultados y publicar en `claude/studia-audit-implementation-deploy-jt3wi9`.

## 7. Pendiente de confirmar por el usuario

- ¿A qué base apunta `DATABASE_URL` del backend de RevenTicket en producción (Railway/Vercel)? La evidencia indica
  que **no** a esta. No pude leer las variables de entorno (Vercel devuelve 403).

## 8. Otros hallazgos (fuera de alcance, sin cambios)

- `otp_codes.code` se guarda en texto plano; recomendable guardar un hash y limitar intentos.
- Login admin compara `ADMIN_PASSWORD` en texto plano con `===` (no en tiempo constante) como alternativa a bcrypt.
- `connect-pg-simple` y `migrate-new-tables.ts` crean tablas sin `enable row level security`.
- El esquema remoto está desfasado respecto a `shared/schema.ts` (faltan `carts`, `payment_reminders`, etc.).
