"""Odds utilities: implied probabilities and bookmaker-margin (vig) removal."""
from __future__ import annotations

from typing import Sequence

import numpy as np


def implied(decimal_odds: Sequence[float]) -> np.ndarray:
    o = np.asarray(decimal_odds, dtype=float)
    if o.ndim != 1 or o.size < 2 or np.any(~np.isfinite(o)) or np.any(o <= 1.0):
        raise ValueError("decimal odds must be a 1-D sequence of finite values > 1")
    return 1.0 / o


def overround(decimal_odds: Sequence[float]) -> float:
    """Bookmaker margin: sum of implied probabilities minus 1."""
    return float(implied(decimal_odds).sum() - 1.0)


def no_vig_proportional(decimal_odds: Sequence[float]) -> np.ndarray:
    """Normalise implied probabilities so they sum to 1 (multiplicative method)."""
    p = implied(decimal_odds)
    return p / p.sum()


def no_vig_power(decimal_odds: Sequence[float], tol: float = 1e-12, max_iter: int = 200) -> np.ndarray:
    """Power method: find k so that sum(p_i ** k) == 1. Corrects favourite/longshot bias better
    than proportional normalisation for most markets."""
    p = implied(decimal_odds)
    lo, hi = 0.5, 5.0
    for _ in range(max_iter):
        k = (lo + hi) / 2
        s = np.power(p, k).sum()
        if abs(s - 1.0) < tol:
            break
        if s > 1.0:
            lo = k
        else:
            hi = k
    q = np.power(p, k)
    return q / q.sum()


def edge(model_probability: float, market_probability: float) -> float:
    return float(model_probability - market_probability)


def expected_value(model_probability: float, decimal_odds: float) -> float:
    """Expected profit per unit staked before costs/limits."""
    if not 0 <= model_probability <= 1 or decimal_odds <= 1:
        raise ValueError("invalid probability or odds")
    return float(model_probability * decimal_odds - 1.0)


def american_to_decimal(american: float) -> float:
    if american == 0 or not np.isfinite(american):
        raise ValueError("american odds cannot be 0")
    return 1.0 + (american / 100.0 if american > 0 else 100.0 / -american)
