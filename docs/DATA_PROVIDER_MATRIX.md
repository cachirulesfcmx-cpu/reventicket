# Matriz de proveedores de datos

No se marca ninguna celda como cubierta sin una cuenta real probada y la licencia comercial revisada.

## Producto (datos en vivo)

| Dominio | Liga MX | UCL | LaLiga | NFL | MLB | NBA |
|---|---|---|---|---|---|---|
| Calendario / resultados | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Histórico | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Estadísticas avanzadas | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Lesiones / alineaciones | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Cuotas (con licencia de visualización) | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Logos / fotos | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

Mientras tanto la app muestra fixtures **demo** etiquetadas y "Datos no disponibles" para lesiones, alineaciones y cuotas.

## Investigación offline (no se redistribuye)

| Fuente | Uso | Cobertura verificada | Licencia |
|---|---|---|---|
| football-data.co.uk `new/MEX.csv` | Backtest Liga MX | 4 779 partidos 2012/13→2026/27; cuotas de cierre Pinnacle (con huecos: 475 de 800 en holdout) | Gratuito para uso personal; **confirmar** antes de uso comercial |
| nflverse/nfldata `games.csv` | Backtest NFL | 7 074 partidos de temporada regular con resultado; moneylines en todo el holdout | Comunitario; **confirmar** licencia y atribución |

Solo se publican en la web métricas agregadas (log loss, Brier, ROI simulado), no filas de datos.

## Antes de contratar un proveedor

Verificar por cada deporte: endpoints, profundidad histórica, identificadores estables, timestamps y estados, lesiones/alineaciones, cuotas y su derecho de visualización, límites de tasa, atribución, almacenamiento permitido, logos/fotos y redistribución. Implementar el adaptador contra `SportsDataProvider` (`apps/web/lib/providers/types.ts`), validar cada evento con `ProviderGameSchema` y registrar cada corrida en `ingestion_runs`.
