# Runbook de despliegue

## 1. GitHub

- Rama: `claude/studia-audit-implementation-deploy-jt3wi9` (no protegida). Sin merge a `main` sin autorización.
- CI (`.github/workflows/ci.yml`) en cada push/PR: security (secretos + auditoría), shared, web (lint, tsc, tests, build, canarios), mobile (tsc, lint, tests, expo-doctor, export Android/iOS), predictor (pytest), database (migraciones + RLS + rollback). Todos los jobs fallan si falla una comprobación.

## 2. Supabase (proyecto `reventicket`, ref `jxdyrzbeykhswpndoing`)

1. Migraciones en orden: `202610240001_initial_schema.sql` (**aplicada**) → `202610280001_hardening.sql` (**pendiente de tu confirmación**).
2. Con CLI: `supabase link --project-ref jxdyrzbeykhswpndoing && supabase db push`. O desde Claude con aprobación del aviso de Supabase.
3. Verificar: `select name from supabase_migrations.schema_migrations;` y que existan los triggers `vanta_*` (3).
4. Auth: activar confirmación de correo; longitud mínima 10; URLs de redirección de la web.
5. Tipos TypeScript: `supabase gen types typescript --project-id jxdyrzbeykhswpndoing > packages/shared/src/database.types.ts` (tras la migración de seguridad).
6. MelatePro (`mvdomupjwfrapbqwczux`) no debe usarse en ningún comando.

## 3. Vercel

### 3a. Preview actual (proyecto existente `reventicket`, sin tocar producción)

El proyecto `reventicket` está configurado para la app Vite antigua (framework `vite`, Output `dist/public`) y sirve producción desde `main`. Para no alterar esa configuración, el Preview se crea por API con **ajustes solo del despliegue**:

```
POST /v13/deployments  (target omitido = preview)
gitSource: { type: github, org: cachirulesfcmx-cpu, repo: reventicket, ref: claude/studia-audit-implementation-deploy-jt3wi9, sha: <commit> }
projectSettings: { rootDirectory: "apps/web", framework: "nextjs", installCommand: "cd ../.. && npm ci",
                   buildCommand: "next build", outputDirectory: ".next", nodeVersion: "22.x",
                   sourceFilesOutsideRootDirectory: true }
```

Tras cada despliegue se verificó que `framework`, `nodeVersion` y `updatedAt` del proyecto no cambiaron. Los pushes a esta rama no generan builds automáticos en este proyecto (`vercel.json` raíz → `git.deploymentEnabled` = false para la rama). Previews protegidos con Vercel Authentication; para pruebas automáticas usar un enlace temporal de compartir (`VERCEL_SHARE_TOKEN`, nunca en Git).

### 3b. Recomendado antes de producción: proyecto propio (requiere permisos que esta sesión no tiene: crear proyecto → 403)

Pasos manuales en el panel del equipo `cachirulesfcmx-cpu's projects`:
1. **Add New → Project →** importar `cachirulesfcmx-cpu/reventicket`, nombre `vanta-edge`.
2. **Root Directory**: `apps/web` · Framework: Next.js · "Include files outside the root directory": activado. `apps/web/vercel.json` ya fija `installCommand: cd ../.. && npm ci` y `buildCommand: next build`.
3. Variables (Preview): `PREDICTIONS_ENABLED=false`, `SPORTS_DATA_PROVIDER=demo`; opcionales `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; secretos `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` como *Sensitive*, solo si se usan.
4. Desplegar la rama como **Preview** (no promover a producción).
5. Smoke: `BASE_URL=https://<url-preview> node apps/web/e2e/smoke.mjs`.

Nota: el proyecto Vercel existente `reventicket` sigue sirviendo la app antigua desde `main` (producción `READY`). El `vercel.json` raíz desactiva sus builds de esta rama para no generar previews fallidos.

## 4. Expo / EAS (bloqueado: sin cuenta)

`cd apps/mobile && npx eas init && npx eas build --profile preview --platform all`. Configurar `EXPO_PUBLIC_API_BASE_URL` con la URL del Preview. Sin ella, la app funciona en modo demo.

## 5. Variables

Ver `.env.example` (solo nombres y valores ficticios).
