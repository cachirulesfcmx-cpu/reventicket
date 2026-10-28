# Resultados de pruebas de humo

## Verificado localmente (build de producción `next start`, 2026-10-28)

Entorno: contenedor Linux, Node 22.22, Chromium (Playwright 1.63). Modo demo, `PREDICTIONS_ENABLED=false`, sin Supabase configurado en la web.

| Comprobación | Resultado |
|---|---|
| HTTP de `/`, `/games`, `/games?sport=NBA`, `/games/demo-nfl-7`, `/picks`, `/performance`, `/follows`, `/responsible` | 200 (13–135 ms) |
| `/games/inexistente`, ruta desconocida | 404 (corregido: antes 200 por `loading.tsx` raíz) |
| `/api/health` | 200, sin valores de configuración |
| `/api/games`, `/api/games/demo-mlb-9`, `/api/picks`, `/api/performance` | 200 |
| `/api/games?sport=CRICKET` | 400 `invalid_query` |
| `POST /api/cron/ingest` sin token | 401 |
| Cabeceras CSP, HSTS, X-Frame-Options | Presentes |
| Navegador 390×844 y 1280×800: 8 páginas, sin scroll horizontal, sin errores de consola/CSP | **22/22 PASS** (`apps/web/e2e/smoke.mjs`) |
| Picks: sin probabilidades reales, todo `isDemo` | PASS |
| Sin promesas de ganar en textos | PASS |

## Verificado en Vercel Preview

**No ejecutado — bloqueado**: crear el proyecto Vercel devolvió 403. Cuando exista la URL: `BASE_URL=https://<preview> node apps/web/e2e/smoke.mjs`.

## Supabase remoto

Migración inicial aplicada y verificada por consulta. Las pruebas RLS contra la API remota quedan pendientes de la migración de seguridad.
