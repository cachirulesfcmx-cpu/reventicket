# RevenTicket: permisos de las tablas antiguas — auditoría final y plan de mínimo privilegio

Estado: **PREPARADO, NO APLICADO.** La ejecución remota queda bloqueada hasta que el usuario (1) confirme la base de
datos real de producción y (2) dé la autorización final. Todo lo remoto de este documento son lecturas
(privilegios, estructura, recuentos y una huella de ids); no se leyeron hashes, OTP, tokens ni datos personales.
MelatePro, VANTA EDGE y `main` no se modificaron.

Hallazgos de la aplicación (registro como admin, contraseña admin en texto plano, OTP en texto plano, desfase de
esquema) → `docs/security/REVENTICKET_APP_FINDINGS.md`, con parches separados.

## 1. Destino de producción — **NO CONFIRMADO**

| Evidencia (rama `main`, commit `1903f11`) | Qué indica |
|---|---|
| `vercel.json`: el frontend reescribe `/api/*` a `https://reventicket-production.up.railway.app` | El backend de producción es un servicio de **Railway** |
| `railway.json` / `nixpacks.toml`: `npm run start` = `node dist/index.cjs` | Railway ejecuta el bundle CJS |
| `server/db.ts`: `pg.Pool({ connectionString: DATABASE_URL })` | La base es la que diga `DATABASE_URL` **en las variables de Railway** |
| `.env.example`: plantilla de pooler de Supabase con usuario `postgres.<ref>` | Plantilla, no prueba del destino real |
| `.replit`: módulo `postgresql-16` | Hubo una etapa en Replit con su propia base |
| `GET https://reventicket-production.up.railway.app/api/health` y `https://reventicket.vercel.app/api/health` (2026-10-29) | **404 "Application not found"** de Railway: **no hay backend en ejecución** |
| Proyecto Supabase `reventicket`: sin conexiones de la app, 0 escrituras desde el último arranque, sin tabla `session` | No prueba nada por sí solo (el backend no está corriendo) |

**Conclusión:** no se puede determinar con la evidencia disponible. El valor de `DATABASE_URL` vive en Railway (y
quizá en Vercel, cuyas variables devuelven 403 a esta sesión). No se deduce por nombres ni por tablas.

**Cómo confirmarlo sin exponer secretos** (cualquiera de las dos):

1. Railway → servicio `reventicket` → *Variables* → `DATABASE_URL`: indicar **solo** si el host/usuario contiene
   `jxdyrzbeykhswpndoing` (o el host de otra base). No copiar la contraseña.
2. Con esa `DATABASE_URL`, ejecutar en un cliente SQL la consulta de solo lectura `verify_remote.sql` y comparar:
   `fingerprint` = `6b64e07366739007bcde994686687995` y `legacy_row_counts` = 1/3/3/0/0/0/0/0 ⇒ es esta base.

Si producción usa **otra** base: este plan no se aplica tal cual; hay que repetir la auditoría allí (la migración
lo exige: huella, tablas inesperadas, políticas).

## 2. Auditoría de la migración SQL

Archivo: `supabase/proposals/reventicket/20261029_reventicket_least_privilege.sql` (no está en
`supabase/migrations/`, así que nada lo aplica automáticamente).

| Requisito | Resultado de la revisión | Cambio hecho en esta fase |
|---|---|---|
| Verificar destino | Antes solo comprobaba tablas/dueño/RLS | **Huella obligatoria** (`expected_fingerprint`, md5 de los ids de las 8 tablas, calculada con `verify_remote.sql`); sin rellenar o distinta ⇒ aborta. Comprueba roles `anon`/`authenticated` (Supabase) |
| Dueño de las tablas y RLS | Sí (`current_user` = dueño de las 8; RLS activo) | — |
| Abortar ante políticas nuevas / estado inesperado | Políticas: sí | **Aborta si hay relaciones en `public` fuera del alcance auditado** (p. ej. `session`, `push_subscriptions` ⇒ el backend ya corrió ahí) |
| Retirar solo privilegios de cliente | `REVOKE ALL … FROM anon, authenticated` en las 8 tablas | — |
| Tablas y secuencias del alcance | 8 tablas (sin secuencias propias: ids `varchar`) | — |
| Privilegios por defecto para objetos nuevos del rol del backend | `ALTER DEFAULT PRIVILEGES` de `current_user` en `public` (tablas y secuencias) | Postcondición nueva: falla si aún conceden a clientes |
| Preservar `postgres` y `service_role` | No se tocan | Probado |
| Registro privado de lo retirado | `reventicket_audit.revoked_privileges` (esquema sin acceso de clientes ni expuesto por la API) | — |
| Transaccional, sin estado parcial | Varias sentencias: dependía del cliente | **Reescrita como UNA sola sentencia `DO`**: atómica con cualquier cliente; probado inyectando un fallo tras los `REVOKE` |
| Reversión limitada a lo guardado | `…_down.sql` restaura solo filas registradas y no restauradas, en tablas existentes; idempotente | — |
| PostgreSQL 17 (`MAINTAIN`) | El remoto es 17.6 | Postcondición y verificación incluyen `MAINTAIN` en ≥17 |

**¿Rompe Supabase Auth u otras partes que usan la API pública?** No:

- Supabase Auth trabaja en el esquema `auth` con su propio rol; estas tablas son `public.*` de RevenTicket.
- VANTA EDGE (web/móvil) solo usa por REST `teams`, `games`, `predictions`, `followed_teams` (búsqueda de
  `.from(...)` en `apps/`); su trigger de alta (`SECURITY DEFINER`) escribe en `profiles`/`user_preferences`.
  Su suite de 41 aserciones pasa después de aplicar la migración (local).
- Efecto colateral intencionado: tablas **nuevas** creadas por `postgres` en `public` ya no serán accesibles por
  REST sin `GRANT` explícito. Las migraciones de VANTA ya conceden explícitamente.

## 3. Tablas que el backend crea al arrancar

| Tabla | Quién la crea | Cuándo | RLS | Privilegios hoy (sin migración) | Con la migración |
|---|---|---|---|---|---|
| `session` | `connect-pg-simple` (`createTableIfMissing`) con el rol de `DATABASE_URL` | Al arrancar | **No** | ALL a `anon`/`authenticated` | Ninguno para clientes |
| `push_subscriptions` (endpoint, `p256dh`, `auth`) | `ensurePushTable()` | Al arrancar | **No** | ALL | Ninguno |
| `discount_codes`, `event_maps` | `server/migrate-new-tables.ts` | Manual | **No** | ALL | Ninguno |
| 14 tablas de `shared/schema.ts` ausentes en remoto | `npm run db:push` | Manual | **No** | ALL | Ninguno si se crean **después** |

Nota: con el bundle de producción `connect-pg-simple` no encuentra `dist/table.sql` (ENOENT) y **no** crea `session`
(ver hallazgos de la app). Además, `drizzle-kit push` contra una base que contiene VANTA **propone renombrar tablas
de VANTA** a tablas de RevenTicket (observado: `ingestion_runs › analytics_events`, `profiles › …`); nunca debe
ejecutarse `db:push` de RevenTicket contra la base compartida.

## 4. Pruebas ejecutadas (resultados reales)

### 4.1 `supabase/proposals/reventicket/test/run.sh` — PostgreSQL 16.15 y 17.11 (CI incluido)

Rol `rt_owner` = réplica de `postgres` de Supabase (dueño, sin superusuario, BYPASSRLS, privilegios por defecto a
clientes), 8 tablas con la estructura remota real y filas ficticias, migraciones de VANTA.

| Comprobación | 17.11 | 16.15 |
|---|---|---|
| Línea base: anon con SELECT en `users`; con RLS desactivado lee la fila (riesgo real) | PASS | PASS |
| Guardas (abortan sin cambios): huella sin rellenar, huella errónea, rol no dueño, tabla inesperada (`session`), política añadida | 5/5 PASS | 5/5 PASS |
| Atomicidad: fallo inyectado tras los `REVOKE` ⇒ ACL, privilegios por defecto y esquema de auditoría intactos (cliente en autocommit) | PASS | PASS |
| Aplicación con la huella confirmada; instantánea | 128 + 22 | 112 + 20 |
| Regresión **48/48**: matriz anon/authenticated × 8 tablas; anon sin hashes/OTP/órdenes/boletos/config, sin crear OTP/usuarios, sin TRUNCATE; authenticated sin escalar rol, sin órdenes ajenas, sin borrar boletos, sin reutilizar OTP, sin tocar config; bloqueo aunque RLS se desactive; RLS y 0 políticas; `service_role` intacto; auditoría inaccesible; flujos del backend (registro/login, OTP, alta admin, compra pagada y boleto emitido, wallet, borrado en cascada); `session`, `push_subscriptions`, `event_maps`, `discount_codes`, tablas de `db:push` privadas; backend con acceso completo a ellas | PASS | PASS |
| Datos preexistentes (md5 de todas las filas) idénticos | PASS | PASS |
| VANTA: triggers/políticas/permisos idénticos; suite de 41 aserciones | PASS | PASS |
| Rollback: ACL y privilegios por defecto idénticos al original; datos intactos; idempotente; no toca objetos ni cambios posteriores | PASS | PASS |
| `verify_remote.sql` tras aplicar: sin acceso de clientes | PASS | PASS |

### 4.2 `supabase/proposals/reventicket/test/backend-smoke.sh` — **backend real** (`main`, `node dist/index.cjs`), PostgreSQL 17.11

A/B: mismo backend, misma base, sin y con migración. Rol del backend: `rt_owner`. Datos y secretos ficticios.

| Escenario | Resultado |
|---|---|
| Esquema idéntico al remoto (8 tablas) | 29 pasos **idénticos** A/B; 0 `permission denied` en el log |
| Esquema completo de `shared/schema.ts` (23 tablas, `db:push` previo) | 29 pasos **idénticos** A/B; compra completa `paid/sold`; 0 `permission denied` |
| Exposición, esquema remoto | Sin migración: **9** tablas legibles por clientes (incl. `push_subscriptions` creada al arrancar). Con migración: **0** |
| Exposición, esquema completo | Sin migración: 23. Con migración: 14 (tablas creadas **antes** y fuera del alcance) ⇒ la migración real se niega a ejecutarse en esa base (guarda de tablas inesperadas) |

Fallos idénticos en A y B, ajenos a los permisos (desfase de esquema y bugs de la app): `otp_codes.verified` y
`events.is_featured` no existen en el esquema remoto; alta de evento por API rechaza fechas en JSON; `session` no se
crea con el bundle (ENOENT `dist/table.sql`). Ver hallazgos de la app.

## 5. Riesgos residuales

| Riesgo | Estado |
|---|---|
| Producción usa otra base | **Abierto** hasta confirmar (§1). La huella impide aplicar en una base distinta |
| El rol de `DATABASE_URL` en producción no es `postgres` | Abierto. Si es otro rol, los privilegios por defecto de **ese** rol no cambian (la migración actúa sobre `current_user`) ⇒ habría que ejecutarla también como ese rol o ampliar |
| Tablas creadas por `supabase_admin` (algunas acciones del panel) | Sus privilegios por defecto no cambian; revisar tablas nuevas tras crearlas |
| `db:push` de RevenTicket en la base compartida | Puede renombrar/eliminar tablas de VANTA. Procedimiento: prohibido; separar RevenTicket en su propio esquema o proyecto |
| Hallazgos de la app (registro como admin, etc.) | Independientes de esta migración; parches preparados y validados (ver documento de hallazgos) |
| Ninguna API externa conocida usa la clave `anon` contra estas tablas | Hoy ya obtendría 0 filas por RLS |

## 6. Procedimiento de aplicación (cuando haya confirmación y autorización)

**Condiciones de aborto (no continuar si cualquiera se cumple):** destino no confirmado; `verify_remote.sql` muestra
`unexpected_relations_in_public` ≠ null, políticas en tablas antiguas, RLS desactivado, `current_user` ≠ dueño,
`audit_rows` activos o recuentos distintos de los esperados; CI rojo en el commit a aplicar.

1. **Pre-check (solo lectura)** en la base confirmada: ejecutar `verify_remote.sql`; guardar el JSON.
2. Copiar la migración, sustituir `__SET_FROM_VERIFY_REMOTE__` por el `fingerprint` del paso 1 (única edición).
3. **Aplicar** como `postgres`: MCP `apply_migration` (aceptar la confirmación interactiva) o SQL Editor, **una sola
   ejecución**. Éxito = `NOTICE RT_APPLIED: 128 table and 22 default privileges revoked and recorded` (PG17).
   Cualquier `RT_PRECONDITION`/`RT_POSTCONDITION` = nada cambió; parar y reauditar.
4. **Post-check (solo lectura)** `verify_remote.sql`: anon/authenticated `false` en las 8; `rls` `true`; 0 políticas;
   `fingerprint` y recuentos idénticos al paso 1; `default_privileges_for_current_user` sin tablas/secuencias para
   clientes (quedan solo las 2 de funciones, fuera de alcance); `audit_rows` = 150; VANTA con 3 triggers y 10
   políticas, `anon_odds`/`anon_raw_metadata` `false`.
5. **VANTA**: re-ejecutar `supabase/tests/remote_verify.sql` ⇒ `VANTA_REMOTE_SUITE_PASSED: 41/41`.
6. **Prueba de humo del backend real** (solo si producción usa esta base y el backend está desplegado): health 200;
   registro + login (sesión y JWT); `jwt-login` admin; OTP envío/verificación; alta admin de recinto/zona/boleto;
   compra y confirmación de pago (`paid/sold`); listado de órdenes admin; logs sin `permission denied`. Usar
   cuentas de prueba y borrarlas después desde el panel admin. Si la app no está desplegada (hoy: 404), se acepta
   como evidencia la prueba A/B local (§4.2).
7. Documentar resultados y publicar en `claude/studia-audit-implementation-deploy-jt3wi9`.

**Recuperación:** si el paso 3 falla, no hay nada que deshacer (una sola sentencia). Si los pasos 4–6 muestran un
problema atribuible a la migración: ejecutar `20261029_reventicket_least_privilege_down.sql` como `postgres`
(restaura solo lo registrado; idempotente), repetir `verify_remote.sql` y comparar con el paso 1. Los datos no
se tocan en ningún caso.

## 7. Acción exacta que debe confirmar el usuario

1. **Destino:** "La `DATABASE_URL` del backend de RevenTicket en producción apunta a `jxdyrzbeykhswpndoing`
   (o a otra base: indicar cuál), con el usuario `postgres`" — o el resultado de `verify_remote.sql` ejecutado con
   esa conexión.
2. **Autorización:** "Autorizo aplicar `20261029_reventicket_least_privilege.sql` en `jxdyrzbeykhswpndoing` con el
   procedimiento de §6".

Sin ambas, no se ejecuta ningún cambio remoto.
