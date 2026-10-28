# Model validation policy

Current state: no production model approved. Prediction publication is disabled by default.

Required for every sport × market:
- Chronological walk-forward evaluation and a locked final holdout.
- Leakage audit and reproducible feature cutoffs.
- Baseline comparisons and, where available, market no-vig comparisons.
- Brier score, log loss, calibration plot/table, coverage, sample size and uncertainty intervals.
- Results segmented by season, competition, market, probability bucket and data quality.
- For simulated returns: timestamped odds, realistic availability, limits, vig/fees and uncertainty; do not extrapolate from a small sample.
- Champion promotion requires pre-registered criteria and independent review. No model is promoted based on in-sample fit alone.
