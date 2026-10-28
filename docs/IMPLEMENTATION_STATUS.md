# Estado de implementación

Leyenda: **Verificado local** = ejecutado en este entorno · **Verificado CI** = GitHub Actions en `4c44bd0` · **Remoto** = servicio real · **Bloqueado** = falta permiso/credencial/dato.

| Área | Estado | Evidencia | Siguiente acción |
| --- | --- | --- | --- |
| Monorepo / dependencias | Completo | Un solo `package-lock.json`; `react@19.3.0` único en el árbol; `expo install --check` limpio | — |
| Build web (Next 16.4) | Completo · Verificado local + CI | `npm run build:web` exit 0 (antes FAIL por React duplicado) | — |
| Web: lint / typecheck / tests | Completo · Verificado local + CI | ESLint 0 avisos · tsc 0 · 23 tests | — |
| Web: páginas y API | Completo (modo demo) | 22/22 smoke local y 22/22 en Preview | — |
| Paquete compartido | Completo | 10 tests | — |
| App Expo | Completo (modo demo) | tsc · lint · 3 tests · expo-doctor 20/20 · export Android+iOS | Builds EAS (bloqueado: cuenta) |
| Predictor | Completo (investigación) | 43 tests; backtests reales Liga MX y NFL | Datos para UCL/LaLiga/MLB/NBA |
| Migración inicial | Aplicada · Remoto | `vanta_initial_schema` en Supabase `reventicket` | — |
| Migración de seguridad | **Pendiente** | 41/41 local + CI; tres intentos remotos sin confirmación del usuario a tiempo (sin cambios parciales) | Aprobar el aviso de Supabase o pegar el SQL en el SQL Editor; luego ejecutar `supabase/tests/remote_verify.sql` (transacción con ROLLBACK) |
| CI GitHub Actions | Completo · Verificado | Run 40730242936: 6/6 jobs success | — |
| Vercel Preview | Completo · Remoto | `dpl_GyYm9dtyJtRPxPra2P9noVhnvc3S` READY (commit `f08dbcb`), smoke 22/22 | Proyecto propio `vanta-edge` antes de producción |
| Proveedor de datos real | **Bloqueado** | Sin clave/licencia | Ver `DATA_PROVIDER_MATRIX.md` |
| Picks reales | Desactivados a propósito | Gate: 0/3 modelos aprobados | — |
| Builds EAS / tiendas | **Bloqueado** | Sin cuenta Expo/Apple/Google | — |
| MelatePro | Intacto | No se ejecutó ninguna operación sobre `mvdomupjwfrapbqwczux` | — |
