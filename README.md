# StudIA

Aplicación educativa multiplataforma (iOS, Android y web) para estudiantes de primaria, secundaria y preparatoria en México: onboarding “liquid glass”, planes de estudio, tutor IA, simulacros calificados en el servidor, materiales privados con lectura asíncrona y espacio familiar con consentimiento parental.

> **Estado:** código listo para staging; despliegue verificado `BLOCKED` (falta proyecto Supabase de staging autorizado). **No** listo para producción ni para uso con menores reales: ver `docs/AUDIT_REPORT.md` y `docs/RELEASE_CHECKLIST.md`.

## Stack

| Capa | Tecnología |
| --- | --- |
| App | Expo SDK 58 · React Native 0.88 · React 19.3 · Expo Router 58 · TypeScript 6 |
| Backend | Supabase (Postgres 17 + RLS, Auth con PKCE, Storage privado, Edge Functions Deno) |
| IA | Proveedor configurable: Anthropic Messages API u OpenAI-compatible (servidor) |
| Web | Export estático (`dist/`) servido con CSP estricta (`vercel.json`) |

## Desarrollo

```bash
npm ci
cp .env.example .env      # completa EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run start             # o npm run web / ios / android
```

Sin variables de Supabase la app arranca igual: el onboarding funciona y las pantallas de cuenta muestran un aviso de configuración.

## Calidad

```bash
npm run typecheck      # TypeScript estricto
npm run lint           # ESLint (expo) sin warnings
npm test               # Jest: lógica, seguridad del tutor, cliente IA, CORS, contraste, evals
npm run test:sql       # Postgres local: migraciones + 78 aserciones de RLS/seguridad
npm run test:rollback  # el rollback de staging revierte y re-aplica limpio
npm run test:perf      # pgbench: lectura con RLS y cuota IA atómica bajo concurrencia
npm run build:web && npm run test:e2e   # Playwright sobre el build de producción
npm run audit:gate     # npm audit con aceptación de riesgos documentada y con caducidad
```

Edge Functions: `cd supabase/functions && deno check */index.ts && deno lint`.

## Documentación

- `docs/ARCHITECTURE.md` — dominios, flujos y decisiones.
- `docs/DEPLOYMENT.md` — variables, secretos, despliegue a staging, rollback.
- `docs/LIQUID_GLASS_ONBOARDING.md` — dirección visual y flujo de 10 pasos.
- `docs/RELEASE_CHECKLIST.md` — requisitos antes de producción.
- `docs/AUDIT_REPORT.md` — auditoría, evidencia de pruebas y veredicto.

Nunca pongas secretos en variables `EXPO_PUBLIC_*`. La `service_role` y las claves de IA viven solo en secretos de Edge Functions.
