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

## Verificado en Vercel Preview (2026-10-28)

- Proyecto: `reventicket` (equipo `cachirulesfcmx-cpu's projects`), despliegue Preview `dpl_GyYm9dtyJtRPxPra2P9noVhnvc3S`, commit `f08dbcb`.
- URL: https://reventicket-qbj57xmyz-cachirulesfcmx-cpus-projects.vercel.app (protegida con Vercel Authentication; HTTPS → 302 a SSO sin sesión).
- Build: Next.js 16.4.3, Node 22.x, Root Directory `apps/web` (solo para el despliegue), 36 s, `READY`.

| Comprobación remota | Resultado |
|---|---|
| Navegador 390×844 y 1280×800, 8 páginas, sin scroll horizontal | PASS |
| Consola / CSP sin errores | PASS (antes FAIL: la barra `vercel.live` de Vercel quedaba bloqueada; corregido solo para Preview en `f08dbcb`) |
| Partido inexistente → 404 | PASS |
| `/api/picks`: publicación desactivada, todo demo, `probability: null` | PASS |
| `/api/games?sport=F1` → 400 | PASS |
| `/api/health` público, sin secretos (`dataMode: demo`, `predictionsFlag: false`, `databaseConfigured: false`) | PASS |
| Escaneo del JS servido (8 scripts): JWT, `sb_secret_…`, service role, `CRON_SECRET`, refs de proyectos Supabase | 0 coincidencias (un falso positivo inicial era el literal `"sb_secret_"` de supabase-js) |
| Hosts contactados | solo el propio Preview, Google Fonts y `vercel.live`; **ningún Supabase** |
| Total smoke | **22/22 PASS** |

Producción (`main` → `1903f11`, `reventicket.vercel.app`, dominios `reventicket.com.mx`) verificada sin cambios después de los despliegues.

## Supabase remoto

Migración inicial aplicada y verificada por consulta. Las pruebas RLS contra la API remota quedan pendientes de la migración de seguridad.
