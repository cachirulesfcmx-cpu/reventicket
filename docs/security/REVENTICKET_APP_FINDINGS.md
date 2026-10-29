# RevenTicket: hallazgos de la aplicación y correcciones

Auditoría del código de `main` (`1903f11`) con pruebas contra el **backend real** (`node dist/index.cjs`, el bundle
que arranca Railway) en bases PostgreSQL 17 locales y desechables, con datos y secretos ficticios.

**Estado:** correcciones publicadas en la rama `reventicket-security-fixes` (PR #1 en borrador contra `main`, sin fusionar) (base `origin/main`, 4 commits),
exportadas aquí como serie de parches. **No están en `main`, no están desplegadas y no se ha tocado ninguna base
remota.** Producción no está corregida mientras no se fusionen y desplieguen.

| Archivo en `docs/security/reventicket-patches/` | Contenido |
|---|---|
| `0001-fix-auth-public-registration-…patch` | F1 |
| `0002-fix-auth-remove-plaintext-ADMIN_PASSWORD-…patch` | F2 |
| `0003-fix-otp-store-HMACs-CSPRNG-…patch` | F3 (añade `server/lib/otp.ts`) |
| `0004-seed-credentials-from-env.py` | F5 (script: un diff mostraría las contraseñas que hoy están en el código) |
| `validate.sh` + `validate.mjs` | Regresión de seguridad antes/después contra el backend real |
| `otp.unit.mts` | Pruebas unitarias de `server/lib/otp.ts` |

Aplicación en un checkout de RevenTicket: `git am docs/…/000[1-3]-*.patch && python3 docs/…/0004-seed-credentials-from-env.py`
(verificado: reproduce byte a byte los archivos validados).

## F1 · CRÍTICO — Registro público como administrador → corregido (0001)

- `POST /api/auth/register` validaba con `insertUserSchema` (incluye `role`) y pasaba todo a `createUser`.
- Corrección: se descarta `role` del cuerpo y el servidor fija `role: "buyer"`. Es la única ruta que asigna rol desde
  datos del cliente (revisado: OTP crea `buyer`; el seed asigna en servidor; `requireAdmin` lee el rol de la base,
  no del JWT).
- Prueba: antes `200 admin` y el atacante crea recintos (`200`); después `200 buyer` y `403`.
- Operación: tras desplegar, contar cuentas por rol en producción (solo recuentos) y revisar las `admin` creadas
  por registro público.

## F2 · ALTO — Contraseña admin en texto plano (`ADMIN_PASSWORD`) → corregido (0002)

- `/api/auth/login` y `/api/auth/jwt-login` aceptaban para cualquier `admin` el valor de `ADMIN_PASSWORD` con `===`.
- Corrección: solo `bcrypt.compare` contra el hash almacenado.
- Casos de error verificados: hash no-bcrypt, vacío o truncado ⇒ `bcrypt.compare` devuelve `false` (401, sin
  excepción); `null` lanzaría, pero la columna es `NOT NULL`. Contraseña errónea y email inexistente ⇒ 401.
- **Riesgo operativo:** si la contraseña del admin remoto se guardó en claro (existe una consulta guardada
  "Reset Admin User Password" en el SQL Editor), tras el parche ese admin no podrá entrar. Antes de desplegar:
  generar un hash bcrypt localmente (`read -rsp 'Nueva contraseña: ' p; echo; printf '%s' "$p" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>require('bcrypt').hash(s,12).then(console.log))"; unset p` (la contraseña no queda en argumentos ni en el historial))
  y actualizarlo con autorización; después **borrar `ADMIN_PASSWORD`** de Railway/Vercel y rotarla.
- Observación (sin cambio): login limitado por el limitador global (~100/15 min por IP; medido 429 tras 93).
  Recomendado un limitador específico más estricto.

## F3 · ALTO — OTP en claro, `Math.random()`, sin límite por teléfono → corregido (0003)

| Aspecto | Antes | Después |
|---|---|---|
| Almacenamiento | código de 6 dígitos en claro | `HMAC-SHA256(OTP_PEPPER \| SESSION_SECRET, "telefono:codigo")` |
| Comparación | igualdad en SQL | `timingSafeEqual` sobre los candidatos activos del teléfono |
| Generación | `Math.random()` | `crypto.randomInt(100000, 1000000)` |
| Códigos anteriores | siguen válidos | un envío nuevo caduca los activos del teléfono |
| Intentos | solo 5/15 min **por IP** (adivinación distribuida posible) | además, 5 fallos por teléfono caducan sus códigos activos |
| Consumo | `UPDATE … WHERE id` (no atómico) | `UPDATE … WHERE id AND verified = false RETURNING` |
| Expiración | 10 min | sin cambio (10 min) |
| Contraseña de usuarios creados por OTP | `Math.random()` | `crypto.randomBytes(32)` |
| Sin `SESSION_SECRET`/`OTP_PEPPER` | — | producción se niega a guardar OTP; desarrollo usa un pepper local |

- Limitación conocida: el contador por teléfono está en memoria (por instancia); la caducidad en base sí aplica a todas.
- Códigos antiguos en claro: nunca coinciden con un HMAC (caducan en 10 min). Sin cambio de esquema.
- En la base remota la columna se llama `used` y el código usa `verified` (F4): OTP falla allí con o sin parche.

## F5 · ALTO — Contraseñas fijas en `server/seed.ts` → corregido (0004)

- El seed crea un admin y un comprador con contraseñas escritas en el código y ejecuta
  `TRUNCATE … RESTART IDENTITY CASCADE` sobre usuarios, órdenes y boletos. No se reproducen aquí.
- Corrección: contraseñas desde `SEED_ADMIN_PASSWORD`/`SEED_BUYER_PASSWORD` (≥12) y negativa con `NODE_ENV=production`.
- Verificado: producción ⇒ "db:seed is disabled in production"; sin variables o cortas ⇒ error, antes de tocar la base.
- Las contraseñas siguen en el **historial** de git de `main`: si alguna cuenta real usa esas credenciales, rotarlas.

## F4 · MEDIO — Esquema remoto desfasado → Plan B elegido (no aplicado; ver `REVENTICKET_PLAN_B.md`)

Inventario completo en `REVENTICKET_SCHEMA_INVENTORY.md`: el backend necesita 24 tablas; en remoto hay 8; faltan 16;
`otp_codes.used` (remoto) vs `verified` (código); falta `events.is_featured`. Efectos: OTP, listado/borrado de eventos
y compra fallan con 500 en el esquema remoto (medido).

Riesgos de `drizzle-kit push` observados localmente:

1. Con VANTA en `public`, propone **renombrar tablas de VANTA** a tablas de RevenTicket.
2. Con datos existentes, al querer añadir `users_email_unique` (la restricción existente tiene otro nombre),
   **ofrece vaciar la tabla `users`** (TRUNCATE). Sin terminal no aplicó nada.

Propuesta validada en local (`supabase/proposals/reventicket/isolation/`):

| Pieza | Qué hace | Resultado local |
|---|---|---|
| `0005-reventicket-own-schema.patch` | `pgSchema("reventicket")` para las 22 tablas + `schemaFilter: ["reventicket"]` | `tsc` sin errores nuevos (27/27 preexistentes) |
| `20261029_reventicket_move_to_own_schema.sql` | Una sentencia `DO`: huella obligatoria, mueve las 8 tablas **con sus filas**, dueño `reventicket_app`, sin acceso de clientes, `used`→`verified`, `is_featured`, nombres de `UNIQUE` como espera drizzle | Filas idénticas; VANTA idéntico; `anon` ⇒ *permission denied*; 2.ª ejecución aborta |
| Rol `reventicket_app` con `search_path = reventicket` | El backend no necesita cambios en SQL crudo | Backend real con la serie 0001–0004 + 0005: **27/27** comprobaciones de `validate.mjs`; 0 tablas creadas en `public`; `push_subscriptions` en `reventicket`; 0 `permission denied` |
| `drizzle-kit push` con `schemaFilter` tras mover | Crea las 14 tablas que faltan | 22 tablas, **sin preguntas de renombrado ni de TRUNCATE**, filas intactas |

Ventajas frente a solo revocar privilegios: el esquema no está expuesto por PostgREST (Supabase expone `public` y
`graphql_public` por defecto) y `anon`/`authenticated` no tienen `USAGE`; VANTA y RevenTicket dejan de compartir
espacio de nombres. Alternativa más fuerte: proyecto Supabase propio para RevenTicket.

## F6 · BAJO — Otros

- `npm run build` (`script/build.ts`, usado por `nixpacks.toml`) empaqueta `bcrypt` y el servidor no arranca
  ("No native build was found"); `npm run build:server` (usado por `railway.json`) lo deja externo y funciona.
  Unificar en `build:server`.
- Con el bundle, `connect-pg-simple` no encuentra `dist/table.sql` ⇒ `session` nunca se crea y las rutas que
  guardan sesión fallan (ENOENT). Crear `session` por migración o copiar `table.sql` al bundle.
- `POST /api/events` rechaza la fecha en JSON (`z.coerce.date()` lo resolvería).
- En desarrollo (`tsx`/ESM) las rutas usan `require("jsonwebtoken")`: la autenticación JWT solo funciona en el bundle.

## Validación (resultados reales, 2026-10-29)

`bash docs/security/reventicket-patches/validate.sh <checkout main> <checkout con 0001–0004>` (PostgreSQL 17.11):

| Comprobación | `main` | Corregido |
|---|---|---|
| ATAQUE registro con `role=admin` ⇒ rol guardado | 200 admin | **200 buyer** |
| ATAQUE el autoregistrado crea un recinto | 200 | **403** |
| ATAQUE login admin con `ADMIN_PASSWORD` | 200 | **401** |
| ATAQUE OTP legible en `otp_codes` | en claro | **HMAC-SHA256** |
| ATAQUE fuerza bruta distribuida: código correcto tras 5 fallos | 200 | **400** |
| ATAQUE mismo OTP 3× en paralelo ⇒ éxitos | 1 | 1 (la carrera no se reprodujo en `main`; el consumo atómico es preventivo) |
| ATAQUE OTP antiguo tras pedir uno nuevo | 200 | **400** |
| Registro, login JWT y sesión, contraseña errónea, email inexistente, registro duplicado | 200/200/200/401/401/400 | idéntico |
| Admin con bcrypt; comprador en rutas admin | 200 / 403 | idéntico |
| OTP erróneo / correcto (login `buyer`) / reutilizado / caducado | 400 / 200 / 400 / 400 | idéntico |
| Alta de zona y boleto, compra, segunda compra del mismo boleto, confirmación de pago, estado final, listados | 200, 200, 200, rechazada, 200, `paid/sold`, 200, 200 | idéntico |
| Secretos o contraseñas en los logs del servidor | ninguno | ninguno |

Resultado: **6 ataques bloqueados, 21 comprobaciones de regresión idénticas** (`SECURITY REGRESSION: PASS`).
`otp.unit.mts`: 11/11. `tsc`: 27 errores antes y después, todos preexistentes y ninguno en archivos modificados.
`npm run build`: cliente y servidor compilan. RevenTicket no tiene linter ni suite de pruebas propia configurados.
