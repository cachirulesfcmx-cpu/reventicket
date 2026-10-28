# Validación de modelos y política de publicación

## Método

- **Walk-forward cronológico**: cada partido se predice *antes* de ver su resultado (modelos online "predecir y luego actualizar"); prueba automática de no-fuga (`test_predictions_never_use_the_result_they_predict`).
- **Temporada inicial** solo de calentamiento; no se puntúa.
- **Hiperparámetros** elegidos en el periodo de desarrollo; la búsqueda nunca recibe el holdout (prueba `test_parameter_selection_never_sees_holdout`).
- **Holdout bloqueado** desde fecha fija versionada: Liga MX ≥ 2024-07-01; NFL ≥ 2023-09-01.
- **Métricas**: log loss, Brier, calibración (ECE y tabla de confiabilidad), diferencias pareadas con IC 95 % bootstrap.
- **Comparaciones**: baseline ingenuo (frecuencias históricas) y mercado (cuotas de cierre sin margen, método de potencia).
- **Simulación de apuestas** (solo investigación): 1 unidad cuando modelo − mercado ≥ 3 pp, a cuota de cierre; ignora límites, disponibilidad real y comisiones.
- **Calidad de datos** (`quality.py`): rechaza timestamps ausentes, futuros, obsoletos o posteriores al corte, probabilidades fuera de rango y marcadores imposibles.

## Gate de promoción (`vanta_predictor/gate.py`)

Todas obligatorias: holdout ≥ 300 eventos · mejora significativa vs baseline (IC superior < 0) · ECE ≤ 0.03 · no peor que el mercado (IC superior ≤ 0) · ≥ 200 apuestas simuladas con IC inferior del ROI > 0. Aun pasando, el estado es "candidato": publicar requiere aprobación humana registrada (`approved_by`, `approved_at`, `validation_report_uri`), exigida por la base de datos.

## Resultados (generados el 2026-10-28)

| Deporte · modelo | Holdout | Log loss modelo / mercado | vs mercado (IC 95 %) | ECE | ROI simulado (IC 95 %) | Gate |
|---|---|---|---|---|---|---|
| Liga MX · elo_davidson | 800 | 1.006 / 0.959 | +0.019 [+0.002, +0.036] | 0.033 | −4.8 % [−22.0, +12.9] (355) | No publicable |
| Liga MX · online_poisson | 800 | 1.005 / 0.959 | +0.016 [+0.000, +0.032] | 0.031 | −5.9 % [−22.0, +11.3] (372) | No publicable |
| NFL · elo_binary | 921 | 0.640 / 0.614 | +0.026 [+0.012, +0.040] | 0.047 | −10.7 % [−20.5, −0.7] (705) | No publicable |

Los tres superan al baseline ingenuo, pero son **peores que el mercado**, y la simulación no muestra ventaja (en NFL el ROI es significativamente negativo). Conclusión: `PREDICTIONS_ENABLED=false` y ningún pick real. Champions League, LaLiga, MLB y NBA: **sin evaluar** (no hay dataset verificado).

Un ROI histórico aislado nunca se presenta como ventaja: se exige comparación con el mercado, intervalos de confianza, tamaño de muestra y costes.

Reproducir: `cd services/predictor && .venv/bin/python -m vanta_predictor.research`.
