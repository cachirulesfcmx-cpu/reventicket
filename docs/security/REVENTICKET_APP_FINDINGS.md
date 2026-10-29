# RevenTicket: hallazgos de la aplicación (separados de la migración de privilegios)

Auditoría de código de `main` (`1903f11`) y pruebas contra el backend real (`node dist/index.cjs`) en bases locales
desechables con datos ficticios. **Nada de esto se ha aplicado a `main` ni a ninguna base remota.** Los parches están
en `docs/security/reventicket-patches/` y se validan con `validate.sh` (antes/después).

Orden de prioridad: credenciales y autorización primero.

## F1 · CRÍTICO — Cualquiera puede registrarse como administrador

- `POST /api/auth/register` valida con `insertUserSchema`, que **no excluye `role`**, y pasa el objeto entero a
  `createUser`. El panel admin solo comprueba `users.role === 'admin'`.
- Reproducido: registro público con `{"role":"admin"}` ⇒ `200`, fila guardada con `role = admin`.
- Impacto: control total del panel (eventos, boletos, órdenes, confirmación de pagos, configuración, push).
- Parche `01-register-role-escalation.patch`: descarta `role` del cuerpo y fuerza `role: "buyer"`.
- Validado: tras el parche, el mismo registro guarda `buyer`.
- Además: revisar en producción si existen cuentas `admin` creadas por registro público (consulta de solo
  recuento por rol; no listar datos personales).

## F2 · ALTO — Contraseña de administrador en texto plano (`ADMIN_PASSWORD`)

- `/api/auth/login` y `/api/auth/jwt-login` aceptan para cualquier cuenta `admin` la contraseña igual a la variable
  `ADMIN_PASSWORD`, comparada con `===` (texto plano, no en tiempo constante), además del hash bcrypt.
- Reproducido: con `ADMIN_PASSWORD` definida, `jwt-login` con ese valor ⇒ `200`.
- Parche `02-admin-plaintext-password.patch`: elimina el atajo; solo `bcrypt.compare`.
- Validado: tras el parche ⇒ `401` con `ADMIN_PASSWORD`; `200` con la contraseña bcrypt.
- Operación: antes de desplegarlo, asegurar que cada admin conoce su contraseña bcrypt (o restablecerla con un
  hash nuevo); después, **borrar `ADMIN_PASSWORD`** de Railway/Vercel y rotarla si se compartió.
- Observación: `jwt-login` y `login` quedan limitados por el limitador global (~100 intentos/15 min por IP;
  medido: 429 tras 93). Recomendado un limitador específico más estricto para credenciales (cambio aparte).

## F3 · ALTO — OTP guardados en texto plano y generados con `Math.random()`

- `otp_codes.code` guarda el código de 6 dígitos tal cual; quien lea la tabla puede iniciar sesión por OTP en
  cuentas ajenas durante 10 minutos. Se genera con `Math.random()` (no criptográfico).
- Parche `03-otp-plaintext.patch`: guarda `HMAC-SHA256(OTP_PEPPER | SESSION_SECRET, telefono:codigo)` y compara
  por HMAC; genera con `crypto.randomInt`. Sin cambio de esquema (los códigos viejos caducan en 10 min).
- Validado: tras el parche se guarda un HMAC de 64 hex; verificación correcta `200`, reutilización `400`,
  código erróneo `400`.
- Recomendado (cambio aparte): límite de intentos por teléfono/código (hoy solo por IP) y `OTP_PEPPER` propio.

## F4 · MEDIO — Esquema remoto desfasado respecto al código

Comparación de la estructura remota (`jxdyrzbeykhswpndoing`, solo lectura) con la que genera `shared/schema.ts`:

| Diferencia | Efecto observado con el backend real |
|---|---|
| `otp_codes`: remoto `used`, código `verified` | `/api/otp/send` y `/api/otp/verify` ⇒ 500 (`column "verified" does not exist`) |
| `events`: falta `is_featured` | `GET /api/events` y `DELETE /api/events/:id` ⇒ 500 |
| 14 tablas ausentes: `analytics_events`, `bans`, `carts`, `discount_codes`, `event_maps`, `idempotency_keys`, `job_locks`, `order_events`, `payment_reminders`, `resale_listings`, `risk_events`, `risk_profiles`, `ticket_pass_uses`, `ticket_passes` | Compra ⇒ 500 en el esquema remoto (funciona con el esquema completo) |
| `session`, `push_subscriptions`: creadas en ejecución, no están en `shared/schema.ts` | Con el bundle, `connect-pg-simple` busca `dist/table.sql` ⇒ ENOENT: **`session` nunca se crea** y los flujos que guardan sesión fallan |

Recomendaciones (cambios aparte, con su propio plan):

1. **No ejecutar `npm run db:push` contra la base compartida**: `drizzle-kit push` propone renombrar tablas de VANTA
   (`ingestion_runs`, `profiles`, … › tablas de RevenTicket) y con `--force` aprueba sentencias destructivas.
2. Pasar a migraciones versionadas (`drizzle-kit generate` + revisión), con `tablesFilter`/`schemaFilter`, y
   mover RevenTicket a su propio esquema (p. ej. `reventicket`) o a su propio proyecto Supabase.
3. Crear `session` y `push_subscriptions` por migración, con RLS y sin privilegios de cliente; poner
   `createTableIfMissing: false` o copiar `table.sql` al bundle.
4. Toda tabla nueva: `enable row level security` y sin `GRANT` a `anon`/`authenticated` salvo necesidad documentada.

## Otros (bajo)

- `POST /api/events` rechaza la fecha enviada como JSON (`expected date, received string`): el alta de eventos por
  API no funciona sin coerción (`z.coerce.date()`).
- En desarrollo (`tsx`, ESM) las rutas usan `require("jsonwebtoken")`, que no existe en ESM: la autenticación JWT
  solo funciona en el bundle CJS.

## Cómo validar los parches

```bash
git -C /ruta/a/reventicket-main status            # árbol limpio
(cd /ruta/a/reventicket-main && npm ci && npm rebuild bcrypt)
bash docs/security/reventicket-patches/validate.sh /ruta/a/reventicket-main
```

Resultado obtenido (PostgreSQL 17.11, 2026-10-29):

| Comprobación | Antes | Después |
|---|---|---|
| Registro con `role=admin` ⇒ rol guardado | `admin` | `buyer` |
| `jwt-login` admin con el valor de `ADMIN_PASSWORD` | 200 | **401** |
| `jwt-login` admin con la contraseña bcrypt | 200 | 200 |
| OTP en `otp_codes.code` | 6 dígitos en claro | HMAC-SHA256 |
| OTP correcto / reutilizado / erróneo | 200 / 400 / 400 | 200 / 400 / 400 |
| Límite de `jwt-login` (sin cambios) | 429 tras 93 | 429 tras 93 |

Los parches no añaden errores de TypeScript (27 antes y después, todos preexistentes).
