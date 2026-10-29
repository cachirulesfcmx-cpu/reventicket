# Revisión de seguridad

## Hallazgos en el código original y corrección

| # | Hallazgo | Corrección | Evidencia |
|---|---|---|---|
| S1 | `anon`/`authenticated` conservaban TODOS los privilegios de tabla (defecto de Supabase); solo RLS los frenaba | `REVOKE ALL` + `GRANT` por columna | Tests "anon cannot write …" |
| S2 | `odds_snapshots` y `raw_metadata` legibles por el público (riesgo de licencia) | Sin política pública de cuotas; `raw_metadata` fuera de los grants | "anon cannot read licensed odds/raw payloads" |
| S3 | Podía publicarse una predicción de un modelo no aprobado (solo se filtraba `is_demo`) | Trigger `vanta_guard_predictions` + política que exige modelo aprobado | "cannot publish … unapproved model" |
| S4 | Predicciones publicadas modificables/borrables (historial no auditable) | Triggers de inmutabilidad (solo campos de liquidación) | "published predictions cannot be rewritten/deleted" |
| S5 | Perfil insertable por el cliente, sin mayoría de edad | Perfil creado por trigger `SECURITY DEFINER` con `adult_attested` obligatorio, solo para registros `app=vanta-edge` | "VANTA signup requires 18+ attestation" |
| S6 | Notificaciones activadas por defecto | `default false` | "notifications are opt-in" |
| S7 | `set_updated_at` sin `search_path` fijo | `set search_path = ''` | — |
| S8 | Next.js no compilaba (React duplicado) | Una sola versión de React | Build PASS |

## Controles vigentes

- RLS en todas las tablas de VANTA; aislamiento A/B probado (41 aserciones en Postgres local y en CI).
- `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` solo en `apps/web/lib/env.ts` (`import 'server-only'`); prueba de canarios sobre `.next/static` y bundles Android/iOS (`scripts/check-bundle.mjs`), con prueba negativa que confirma la detección.
- Escaneo de secretos en archivos versionados (`scripts/check-secrets.mjs`), 0 hallazgos; sin `.env` en Git.
- API: validación zod, rate limit (60/min por IP e instancia), errores sin stack ni mensajes internos (test), `Cache-Control: no-store`.
- Web: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy`.
- Cron de ingesta: `Bearer CRON_SECRET` con comparación de tiempo constante; falla cerrado sin secreto.
- No se usan LLM: no hay superficie de prompt injection ni coste de IA.

## Pendiente / riesgos aceptados

- **Migración de seguridad aplicada en remoto (2026-10-29)**, verificada estructuralmente (objetos, políticas, privilegios y funciones; ver tabla abajo). **Las 41 aserciones de `supabase/tests/remote_verify.sql` aún no se han ejecutado en remoto**: el intento quedó sin confirmación del usuario. Hasta entonces, la evidencia de comportamiento es la local/CI (41/41).
- Tablas de RevenTicket en el mismo proyecto (`config`, `events`, `orders`, `otp_codes`, `tickets`, `users`, `venues`, `zones`) conservan TODOS los privilegios de tabla para `anon`/`authenticated` (solo RLS los frena). No pertenecen a VANTA y no se tocaron. Análisis y recomendación: `docs/security/REVENTICKET_LEGACY_GRANTS.md`.
- `script-src 'unsafe-inline'` necesario para Next sin nonces; mejora futura: CSP con nonce.
- Rate limit en memoria: añadir reglas de Vercel Firewall en producción.
- GHSA-mrhx-c7xc-m3w5 (zod 3 dentro de `@expo/cli`, herramienta de desarrollo): aceptado hasta 2027-01-31 en `docs/security/audit-allowlist.json`.
- La declaración de mayoría de edad no verifica identidad; revisar requisitos legales (México: Ley Federal de Juegos y Sorteos, LFPDPPP) y políticas de Apple/Google para apps de apuestas/análisis deportivo.
- Contraseña mínima de 10 caracteres en cliente; configurar la misma política y confirmación de correo en Supabase Auth.

## Verificación remota (Supabase `reventicket`, 2026-10-29)

| Comprobación | Resultado |
|---|---|
| Proyecto | `jxdyrzbeykhswpndoing` = reventicket (MelatePro es `mvdomupjwfrapbqwczux`) |
| Historial | Solo `vanta_initial_schema`: la migración de seguridad se aplicó por SQL Editor, que no registra historial |
| Triggers | `vanta_on_auth_user_created`, `vanta_predictions_guard`, `vanta_predictions_no_delete` (único trigger en `auth.users`) |
| Tablas/vistas | `data_sources`, `ingestion_runs` con RLS; `data_freshness` y `published_performance` con `security_invoker=true` |
| Políticas públicas | Sin política de cuotas; predicciones solo de modelos aprobados; `data_sources` solo atribución |
| Privilegios VANTA | `anon`: sin privilegios de tabla en las tablas VANTA (solo grants por columna y SELECT en las 2 vistas); sin SELECT sobre `games.raw_metadata`, `predictions.feature_snapshot`, `odds_snapshots`, `ingestion_runs`, `profiles` |
| Funciones | 4 funciones con `search_path=''`; solo `vanta_handle_new_user` es `SECURITY DEFINER`; `anon` sin EXECUTE |
| Defaults | `notifications_enabled` = `false` |
| Datos | 0 filas en tablas VANTA, 0 usuarios, sin esquema `vanta_test_tmp` (antes del intento de pruebas) |
| Suite de 41 aserciones | **Pendiente**: no ejecutada en remoto (dos intentos, 2026-10-29, sin confirmación del usuario a tiempo). Desde `51d5d9c` el script es una sola sentencia `DO` que siempre termina en excepción (atómica en cualquier modo de cliente); validado localmente en autocommit, `-1` y con fallo inyectado: 41/41, 0 residuos, datos previos intactos |
| Línea base previa al intento | 0 usuarios, 0 filas VANTA, sin `vanta_test_tmp`, 3 triggers `vanta_*` |
