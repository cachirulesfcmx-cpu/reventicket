# Despliegue de StudIA

Orden obligatorio: **local → staging → (aprobación) → producción**. Nada de esta guía se ejecuta contra producción sin autorización explícita del responsable.

## 1. Variables

### Cliente (públicas, `EXPO_PUBLIC_*`, EAS env / Vercel env)

| Variable | Propósito |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave publicable/anon (segura en cliente; RLS protege datos) |
| `EXPO_PUBLIC_APP_ENV` | `development` · `staging` · `production` |
| `EXPO_PUBLIC_PRIVACY_NOTICE_VERSION` | Versión del aviso aceptado (se guarda con cada consentimiento) |
| `EXPO_PUBLIC_PRIVACY_NOTICE_URL` | URL pública del aviso definitivo |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Canal ARCO/soporte |

### Servidor (secretos de Edge Functions — `supabase secrets set`, nunca en Git)

| Secreto | Propósito |
| --- | --- |
| `AI_PROVIDER` | `anthropic` (por defecto) u `openai_compatible` |
| `AI_API_KEY` | Clave del proveedor de IA |
| `AI_MODEL` | Modelo a usar (sin valor por defecto, se elige explícitamente) |
| `AI_BASE_URL` | Opcional, endpoint compatible |
| `AI_TIMEOUT_MS` | Opcional, por defecto 25000 |
| `AI_PRICE_INPUT_PER_MTOK` / `AI_PRICE_OUTPUT_PER_MTOK` | USD por millón de tokens para estimar gasto |
| `AI_DAILY_BUDGET_USD` | Tope global diario: al alcanzarlo el tutor responde 503 |
| `AI_ALERT_THRESHOLD_USD` | Umbral de alerta (por defecto 80 % del tope) |
| `ALERT_WEBHOOK_URL` | Opcional, webhook (Slack/Teams) para alertas de gasto |
| `APP_ALLOWED_ORIGINS` | Orígenes web permitidos, separados por coma (sin `*`) |
| `WORKER_SECRET` | Secreto compartido del scheduler → `process-materials` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente en Edge Functions.

Verificar sin mostrar valores: `supabase secrets list` (solo nombres/digest) y `GET /functions/v1/health` (booleans de configuración).

## 2. Staging (Supabase)

```bash
supabase link --project-ref <STAGING_REF>
supabase db push                       # aplica supabase/migrations en orden
supabase secrets set --env-file ./staging.secrets.env   # archivo local fuera de Git
supabase functions deploy tutor delete-account health
supabase functions deploy process-materials --no-verify-jwt
```

Auth (Dashboard → Authentication): confirmación de correo **activada**, longitud mínima 10 con mayúsculas/minúsculas/dígitos, URLs de redirección: `studia://auth/callback`, `https://<web-staging>/auth/callback`. Activar MFA para administradores.

Worker de materiales (cada minuto) con `pg_cron` + `pg_net` (guardar `WORKER_SECRET` en Vault):

```sql
select cron.schedule('studia-materials', '* * * * *', $$
  select net.http_post(
    url := 'https://<STAGING_REF>.supabase.co/functions/v1/process-materials?max=3',
    headers := jsonb_build_object('x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'studia_worker_secret'))
  );
$$);
```

Administrador inicial (SQL Editor, una sola vez): `update public.user_profiles set is_admin = true where id = '<uuid>';`

## 3. Verificación de staging

1. `GET /functions/v1/health` → `ok: true`, todos los `config.*` en `true`.
2. Registro de adulto → correo → `/auth/callback` → inicio de sesión; recuperación de contraseña.
3. Crear perfil de estudiante con consentimiento; intentar crear sin consentimiento (debe fallar).
4. Subir PDF/imagen/TXT → estado `ready`; abrir con URL firmada; eliminar (archivo y fila).
5. Tutor: pregunta normal, mensaje de crisis (respuesta segura sin llamar al modelo), límite diario (429).
6. Plan → sesiones generadas; simulacro → calificación; progreso y reporte familiar.
7. `npm run eval:model` con cuenta de prueba y revisión humana de rúbricas.
8. Revisar logs (Edge Functions) — sin contenido de usuarios — y Advisors de seguridad/rendimiento.

## 4. Web

`vercel.json` define build (`expo export`), salida `dist/`, SPA rewrites y cabeceras (CSP, HSTS, X-Frame-Options…). Despliegues de rama = **preview**. Configurar `EXPO_PUBLIC_*` de staging en el entorno Preview de Vercel. Promover a producción solo con aprobación.

## 5. Móvil (EAS)

```bash
eas init                     # crea projectId (requiere cuenta Expo)
eas env:create --environment preview ...   # EXPO_PUBLIC_* de staging
eas build --profile preview --platform android   # APK interno
eas build --profile preview --platform ios       # requiere Apple Developer
eas submit --platform ios --profile production   # TestFlight, tras aprobación
```

## 6. Rollback

- **App web:** “Instant Rollback” al despliegue anterior en Vercel.
- **Edge Functions:** volver a desplegar la versión previa desde Git (`git checkout <tag> && supabase functions deploy ...`).
- **Base de datos (staging):** `supabase/rollback/20261028_staging_down.sql` (probado por `npm run test:rollback`). En producción: PITR/backup y migraciones *forward-fix*; nunca el script destructivo sin decisión de incidente.
- **IA:** bajar `AI_DAILY_BUDGET_USD` a `0` corta todo el gasto de inmediato.

## 7. Backups

El plan Free de Supabase no ofrece backups descargables ni PITR. Para producción: plan Pro (backups diarios) + PITR opcional, y un simulacro de restauración documentado antes del lanzamiento.
