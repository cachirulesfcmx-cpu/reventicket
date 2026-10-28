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

- **Migración de seguridad aún no aplicada en remoto** (requiere tu confirmación en Supabase). Hoy las tablas están vacías.
- `script-src 'unsafe-inline'` necesario para Next sin nonces; mejora futura: CSP con nonce.
- Rate limit en memoria: añadir reglas de Vercel Firewall en producción.
- GHSA-mrhx-c7xc-m3w5 (zod 3 dentro de `@expo/cli`, herramienta de desarrollo): aceptado hasta 2027-01-31 en `docs/security/audit-allowlist.json`.
- La declaración de mayoría de edad no verifica identidad; revisar requisitos legales (México: Ley Federal de Juegos y Sorteos, LFPDPPP) y políticas de Apple/Google para apps de apuestas/análisis deportivo.
- Contraseña mínima de 10 caracteres en cliente; configurar la misma política y confirmación de correo en Supabase Auth.
