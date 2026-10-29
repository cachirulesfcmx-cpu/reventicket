# RevenTicket · Plan B: esquema dedicado `reventicket` y despliegue de seguridad

Estado (2026-10-29): **preparado y probado en local; nada aplicado en remoto.** Plan elegido por el usuario como
opción preferida. Escrituras remotas, merge y despliegue **no autorizados** todavía. VANTA EDGE y MelatePro intactos.

Archivos:

| Archivo | Qué es |
|---|---|
| `supabase/proposals/reventicket/isolation/20261029_reventicket_move_to_own_schema.sql` | Traslado (una sola sentencia `DO`, con huella obligatoria y registro del estado original) |
| `supabase/proposals/reventicket/isolation/20261029_reventicket_move_to_own_schema_down.sql` | Rollback exacto (dueños, ACL, nombres de columnas/restricciones; conserva filas) |
| `supabase/proposals/reventicket/isolation/0005-reventicket-own-schema.patch` | Cambio de app: `pgSchema("reventicket")` para todas las tablas, `session` y `push_subscriptions` declaradas, `schemaFilter: ["reventicket"]` |
| `supabase/proposals/reventicket/isolation/test/run.sh` | Prueba reproducible de todo lo anterior (27 comprobaciones) |
| `supabase/proposals/reventicket/operator/identify_production_db.sh` | Identificación del destino desde Railway (solo lectura, sin imprimir secretos) |

## 1. Inventario remoto (solo lectura, `jxdyrzbeykhswpndoing`, PostgreSQL 17.6)

| Elemento | Resultado |
|---|---|
| Tablas | 8 en `public`: `config`, `events`, `orders`, `otp_codes`, `tickets`, `users`, `venues`, `zones`; dueño `postgres`; RLS activado; 61 columnas |
| Restricciones | 17: 8 PK, 2 UNIQUE (`users_email_key`, `config_key_key`), 7 FK **solo entre ellas** (`events→venues`, `zones→events`, `tickets→events/zones/users`, `orders→tickets/users`) |
| Índices | 10 (los de PK/UNIQUE) |
| Secuencias | Ninguna (ids `varchar` con `gen_random_uuid()`, función del núcleo) |
| Valores por defecto | `gen_random_uuid()::text`, `now()`, literales |
| Triggers / políticas / reglas | Ninguno |
| Funciones que las mencionan | Ninguna |
| Dependencias externas | Ninguna: ni vistas, ni FK desde o hacia otras tablas (VANTA incluido) |
| Esquema `reventicket` / rol `reventicket_app` | No existen |
| Exposición REST | PostgREST expone `public` y `graphql_public` (por defecto); `reventicket` **no debe** añadirse a *Exposed schemas* |
| Filas | 1 `users`, 3 `events`, 3 `venues`; resto vacías. Huella `6b64e07366739007bcde994686687995` |

El backend necesita además 16 tablas que faltan (ver `REVENTICKET_SCHEMA_INVENTORY.md`) y tiene dos diferencias de
columna (`otp_codes.used`→`verified`, falta `events.is_featured`).

## 2. Diseño

| Aspecto | Decisión |
|---|---|
| Esquema | `reventicket`, dueño `reventicket_app`; `USAGE`/`CREATE` revocados a `PUBLIC`, `anon`, `authenticated` |
| Rol del servidor | `reventicket_app`: `LOGIN`, sin superusuario, sin `BYPASSRLS`, sin `CREATEROLE`/`CREATEDB`, `NOINHERIT`, sin pertenencia a otros roles, `search_path = reventicket`. Es dueño de sus tablas (no necesita `BYPASSRLS`) y no tiene `CREATE` en `public` |
| Contraseña del rol | Generada fuera de archivos y chats; se crea en el panel de Supabase o con una sentencia única, y solo se guarda en Railway |
| Conexión | `DATABASE_URL` de Railway con usuario de pooler `reventicket_app.<project-ref>`; el `search_path` va en el rol, así que el SQL crudo del backend (`pool.query` sin esquema) funciona sin cambios |
| Tablas movidas | `ALTER TABLE … SET SCHEMA` (las filas, índices, FK y defaults viajan con la tabla), dueño `reventicket_app`, sin privilegios para clientes ni `service_role` |
| Desfase | `used`→`verified`; `is_featured boolean not null default false`; UNIQUE renombradas a `users_email_unique`/`config_key_unique` (si no, `drizzle-kit push` ofrece **vaciar** la tabla para recrearlas) |
| Tablas de ejecución | `session` (connect-pg-simple no puede crearla desde el bundle) y `push_subscriptions` creadas por el traslado con los nombres exactos que declara 0005 |
| Drizzle | 0005: todas las tablas en `pgSchema("reventicket")` y `schemaFilter: ["reventicket"]`. Además, por privilegios, aunque alguien ejecute `db:push` sin el filtro, `reventicket_app` no puede crear ni alterar nada en `public` |
| Registro para rollback | `reventicket_audit.schema_move`: dueño y ACL originales, restricciones/columnas renombradas o añadidas |
| PostgreSQL 16+ | `postgres` (con `CREATEROLE`) se concede temporalmente `reventicket_app` para traspasar la propiedad y lo revoca al final; solo queda la concesión `ADMIN` implícita del creador (sin `INHERIT` ni `SET`) |

## 3. Pruebas (resultados reales, PostgreSQL 16.15 y 17.11)

`bash supabase/proposals/reventicket/isolation/test/run.sh <checkout main> <checkout correcciones + 0005>` emula
Supabase (`rt_owner` = `postgres`: dueño, sin superusuario, `BYPASSRLS`, `CREATEROLE`, privilegios por defecto a
clientes en `public`), con las migraciones de VANTA y las 8 tablas con su estructura real y filas ficticias.

| # | Comprobación | 16.15 | 17.11 |
|---|---|---|---|
| 1 | Copia: `pg_dump` de las 8 tablas restaura en una base vacía con filas idénticas | PASS | PASS |
| 2–7 | Guardas que abortan sin cambios: sin rol; rol miembro de `anon`; huella sin rellenar; abreviada; errónea; rol que no es dueño | PASS | PASS |
| 8 | Atomicidad: fallo inyectado después de mover todas las tablas ⇒ nada cambia | PASS | PASS |
| 9–10 | Traslado en una petición (cliente autocommit); filas idénticas | PASS | PASS |
| 11 | `public` de VANTA idéntico: relaciones, dueños, ACL, columnas, restricciones, políticas, triggers, funciones | PASS | PASS |
| 12–16 | 0 tablas antiguas en `public`; 10 en `reventicket` del rol; clientes sin acceso (`anon` ⇒ *permission denied*); atributos y `search_path` del rol; el rol ejecutor no puede usar ni cambiar a `reventicket_app` | PASS | PASS |
| 17 | Re-ejecutar el traslado aborta | PASS | PASS |
| 18 | `db:push` de `main` **sin** filtro como `reventicket_app`: no puede tocar VANTA ni crear nada en `public` | PASS | PASS |
| 19–20 | `db:push` con 0005: crea las 14 tablas que faltan (24 en total) sin preguntas de renombrado/vaciado/borrado; filas y VANTA idénticos | PASS | PASS |
| 21–24 | Backend real (correcciones + 0005) con `reventicket_app`: **27/27** (ataques bloqueados + registro, login, OTP, admin, eventos, compra, emisión); nada en `public`; `push_subscriptions` en `reventicket`; logs sin *permission denied* ni secretos; VANTA idéntico | PASS | PASS |
| 25–27 | Rollback en base nueva: catálogo original exacto (dueños, ACL incl. `anon`/`authenticated`/`service_role`, columnas, defaults, restricciones, índices); filas y VANTA idénticos; segundo rollback se niega | PASS | PASS |

## 4. Procedimiento (cuando haya autorización; nada de esto se ha ejecutado)

**Condiciones de aborto:** destino no confirmado (§5); `identify_production_db.sh` no muestra `supabase ref`
`jxdyrzbeykhswpndoing`, las 8 tablas, `unexpected_relations_in_public = null` y la huella completa esperada; la app
sigue escribiendo; no hay copia verificada; cualquier `RT_MOVE…` en la ejecución.

1. **Ventana de mantenimiento:** backend detenido (hoy ya lo está: Railway 404).
2. **Copia** (operador, máquina segura, fuera del repositorio; contiene datos personales y un hash):
   `pg_dump -Fc --no-owner --no-acl -t public.config -t public.events -t public.orders -t public.otp_codes -t public.tickets -t public.users -t public.venues -t public.zones "$DATABASE_URL_POSTGRES" -f reventicket-<fecha>.dump`
   y comprobar `pg_restore --list reventicket-<fecha>.dump` (8 tablas). El plan del proyecto es FREE: no hay PITR.
3. **Pre-check (solo lectura):** `identify_production_db.sh` ⇒ guardar el JSON y la huella **completa** (32 caracteres).
4. **Rol:** crear `reventicket_app` con contraseña generada (`openssl rand -base64 32`), escrita solo en el panel de
   Supabase / Railway: `create role reventicket_app login noinherit nocreatedb nocreaterole nobypassrls password '…';`
5. **Traslado:** pegar la huella en `expected_fingerprint` y ejecutar el archivo **una vez** como `postgres` (SQL Editor
   o `apply_migration`). Éxito = `RT_MOVED: 8 tables + session + push_subscriptions …`.
6. **Post-check (solo lectura):** `0` tablas antiguas en `public`; 10 en `reventicket` de `reventicket_app`;
   `has_schema_privilege('anon','reventicket','usage') = false`; filas: mismos recuentos y huella calculada sobre
   `reventicket.*`; VANTA: `supabase/tests/remote_verify.sql` ⇒ `VANTA_REMOTE_SUITE_PASSED: 41/41`.
7. **Conexión:** en Railway, `DATABASE_URL` con usuario `reventicket_app.<ref>` y su contraseña (pooler de transacciones);
   verificar con `railway run` + `psql -c "begin read only; show search_path; select current_user; rollback"` ⇒
   `reventicket` / `reventicket_app`.
8. **Esquema completo:** con el código 0001–0005 y esa `DATABASE_URL`, `npx drizzle-kit push` (con `schemaFilter`) o,
   preferible, migraciones generadas (`drizzle-kit generate`) revisadas y aplicadas. **Nunca** `db:push` con `postgres`.
9. **Despliegue de la app** (§6) y pruebas de humo.

**Rollback:** detener la app; ejecutar `…_down.sql` como `postgres` (restaura dueño `postgres`, ACL originales,
`used`, quita `is_featured`, nombres de UNIQUE originales); volver `DATABASE_URL` al usuario anterior y desplegar la
versión previa. Las tablas creadas después (14 + `session` + `push_subscriptions`) quedan en `reventicket` y los
valores escritos en `is_featured` se pierden (documentado). Si el rollback no fuese posible: restaurar la copia del
paso 2 con `pg_restore`.

## 5. Identificación del destino — bloqueada

- Railway: `https://reventicket-production.up.railway.app/api/health` ⇒ **404 "Application not found"** (2026-10-29).
- Este entorno no tiene la CLI de Railway ni credenciales de Railway; no se ejecutó `identify_production_db.sh`.
- Falta: que el operador ejecute, en su equipo con la CLI de Railway iniciada,
  `railway run -- bash supabase/proposals/reventicket/operator/identify_production_db.sh` y comparta la salida
  (host, puerto, base, usuario, referencia de Supabase, huella completa; sin secretos). Alternativa: guardar un
  token de Railway **de solo lectura** como secreto del entorno (`RAILWAY_TOKEN`) desde la configuración del entorno,
  nunca en el chat. Si el servicio ya no existe, confirmarlo: entonces no hay backend de producción que identificar.

## 6. Despliegue de seguridad (preparado, no ejecutado)

| Requisito | Estado / acción |
|---|---|
| Código | PR #1 (`reventicket-security-fixes`, 4 commits, borrador) + 0005 como cambio aparte (requiere el traslado) |
| `OTP_PEPPER` | Generar con `openssl rand -hex 32` directamente en el panel de Railway; nunca en archivos ni chats. Producción se niega a guardar OTP sin él (o sin `SESSION_SECRET`) |
| Admin a bcrypt **antes** de activar 0002 | Generar el hash localmente: `read -rsp 'Nueva contraseña: ' p; echo; printf '%s' "$p" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>require('bcrypt').hash(s,12).then(console.log))"; unset p` (la contraseña no queda en argumentos ni en el historial) y actualizar el usuario admin por su `id` (sin leer el hash actual), con autorización. Verificar el login bcrypt antes de desplegar |
| `ADMIN_PASSWORD` | Mantener hasta verificar el login bcrypt con la versión nueva; después borrarla de Railway y Vercel y rotarla si se compartió |
| Credenciales fijas del historial | Las del seed de `main` (admin y comprador de prueba): si alguna cuenta real las usa, rotarla. Comprobación sin datos personales: recuento de usuarios con los emails del seed (constantes del código) |
| Build | `npm run build:server` (no `npm run build`: empaqueta `bcrypt` y el servidor no arranca). Verificado: el bundle arranca (`serving on port`) y carga `bcrypt` |
| Pruebas de humo | Cuentas de prueba; registro con `role=admin` ⇒ `buyer` y 403 en rutas admin; `ADMIN_PASSWORD` ⇒ 401; admin bcrypt ⇒ 200; OTP correcto 200 / reutilizado 400 / 5 fallos 400; compra y confirmación ⇒ `paid/sold`; borrar las cuentas de prueba |
| Vercel | El push de la rama generó **automáticamente** un Preview del frontend (`dpl_6rbH6fu3Xi8zrT3azb8LRBXAXx1P`, `target: null`). Producción sigue en `main` `1903f11` (`dpl_2rMTZq1zY45M8PFnYhhtwdwuTZy5`) |

## 7. Autorizaciones pendientes

1. Identificación del destino (§5): salida del script o confirmación de que el servicio no existe.
2. Escritura remota: crear `reventicket_app` y ejecutar el traslado en el destino confirmado (§4).
3. Código: segundo PR con 0005 (depende del traslado); merge de PR #1 y del de 0005.
4. Despliegue en Railway y cambio de `DATABASE_URL`, `OTP_PEPPER` y retirada de `ADMIN_PASSWORD`.
