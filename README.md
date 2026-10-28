# VANTA EDGE — Sports Intelligence

Plataforma de **análisis deportivo informativo** (web + iOS/Android) para Liga MX, Champions League, LaLiga, NFL, MLB y NBA: calendario, fichas de partido, probabilidades explicables, historial inmutable y rendimiento de modelos. **No acepta apuestas, no custodia dinero y no enlaza a operadores.**

> Estado: MVP en **modo demostración**. `PREDICTIONS_ENABLED=false`: ningún modelo ha superado la validación contra el mercado (ver `docs/MODEL_VALIDATION.md`).

## Estructura

```
apps/web            Next.js 16 (dashboard + API) — despliegue en Vercel (Root Directory: apps/web)
apps/mobile         Expo SDK 58 (iOS/Android)
packages/shared     Tipos, esquemas zod, cálculo de cuotas/probabilidades, explicaciones, fixtures demo
services/predictor  Python: baselines, backtesting walk-forward, gate de promoción, API FastAPI
supabase/           Migraciones, pruebas RLS (Postgres local), rollback
scripts/            Escaneo de secretos, chequeo de bundles, gate de auditoría, exportación de resultados
docs/               Estado, despliegue, datos, validación, seguridad, smoke tests, rollback
```

## Requisitos

Node 20.19+ (CI usa 22) y npm 10 · Python 3.13 · PostgreSQL 16+ (solo para pruebas SQL locales).

## Comandos

```bash
npm ci                                   # instalación reproducible (un solo package-lock.json)
npm run dev:web                          # http://localhost:3000 (funciona sin secretos, modo demo)
npm run dev:mobile                       # Expo (Expo Go / simulador)
npm run typecheck && npm run lint && npm test
npm run build:web
npm run test:sql && npm run test:rollback   # migraciones + 41 aserciones RLS en Postgres local
node scripts/check-secrets.mjs && npm run audit:gate
cd services/predictor && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python -m pytest -q
.venv/bin/python -m vanta_predictor.research   # backtests reales (descarga datos a .data-cache, no versionado)
node scripts/export-research-summary.mjs        # copia métricas agregadas a la web
BASE_URL=http://127.0.0.1:3000 node apps/web/e2e/smoke.mjs   # smoke test en navegador
```

## Documentación

- `docs/IMPLEMENTATION_STATUS.md` — estado por área con evidencia.
- `docs/ARCHITECTURE.md` — arquitectura, flujos y seis deportes.
- `docs/DEPLOYMENT_RUNBOOK.md` — Supabase, Vercel, Expo/EAS, GitHub Actions, variables.
- `docs/DATA_PROVIDER_MATRIX.md` — cobertura y licencias de datos.
- `docs/MODEL_VALIDATION.md` — método estadístico, resultados y política de publicación.
- `docs/SECURITY_REVIEW.md` — RLS, secretos, riesgos aceptados.
- `docs/SMOKE_TEST_RESULTS.md` — resultados reales de pruebas de humo.
- `docs/ROLLBACK.md` — recuperación ante fallos.
