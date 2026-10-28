"""Probabilistic forecast metrics with uncertainty estimates."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

EPS = 1e-12


def _as_2d(probs: np.ndarray) -> np.ndarray:
    p = np.asarray(probs, dtype=float)
    return p[:, None] if p.ndim == 1 else p


def brier(probs: np.ndarray, outcomes: np.ndarray) -> float:
    """Multiclass Brier score (sum over classes, mean over events). Binary: pass P(class 1) and 0/1."""
    p = np.asarray(probs, dtype=float)
    y = np.asarray(outcomes)
    if p.ndim == 1:
        return float(np.mean((p - y) ** 2))
    onehot = np.eye(p.shape[1])[y.astype(int)]
    return float(np.mean(np.sum((p - onehot) ** 2, axis=1)))


def log_loss(probs: np.ndarray, outcomes: np.ndarray) -> float:
    p = np.asarray(probs, dtype=float)
    y = np.asarray(outcomes)
    if p.ndim == 1:
        p = np.clip(p, EPS, 1 - EPS)
        return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
    chosen = np.clip(p[np.arange(len(y)), y.astype(int)], EPS, 1.0)
    return float(-np.mean(np.log(chosen)))


def per_event_log_loss(probs: np.ndarray, outcomes: np.ndarray) -> np.ndarray:
    p = np.asarray(probs, dtype=float)
    y = np.asarray(outcomes)
    if p.ndim == 1:
        p = np.clip(p, EPS, 1 - EPS)
        return -(y * np.log(p) + (1 - y) * np.log(1 - p))
    return -np.log(np.clip(p[np.arange(len(y)), y.astype(int)], EPS, 1.0))


@dataclass
class CalibrationBin:
    lower: float
    upper: float
    count: int
    mean_predicted: float
    observed_rate: float


def calibration(prob: np.ndarray, hit: np.ndarray, bins: int = 10) -> tuple[list[CalibrationBin], float]:
    """Reliability table and expected calibration error for binary events."""
    prob = np.asarray(prob, dtype=float)
    hit = np.asarray(hit, dtype=float)
    edges = np.linspace(0, 1, bins + 1)
    table: list[CalibrationBin] = []
    ece = 0.0
    for i in range(bins):
        mask = (prob >= edges[i]) & (prob < edges[i + 1] if i < bins - 1 else prob <= edges[i + 1])
        n = int(mask.sum())
        if n == 0:
            continue
        mp, orate = float(prob[mask].mean()), float(hit[mask].mean())
        table.append(CalibrationBin(float(edges[i]), float(edges[i + 1]), n, mp, orate))
        ece += n / len(prob) * abs(mp - orate)
    return table, float(ece)


def bootstrap_mean_ci(values: np.ndarray, n_boot: int = 2000, alpha: float = 0.05, seed: int = 7) -> tuple[float, float, float]:
    """Mean with a percentile bootstrap confidence interval."""
    v = np.asarray(values, dtype=float)
    if v.size == 0:
        return float("nan"), float("nan"), float("nan")
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, v.size, size=(n_boot, v.size))
    means = v[idx].mean(axis=1)
    return float(v.mean()), float(np.quantile(means, alpha / 2)), float(np.quantile(means, 1 - alpha / 2))


def paired_difference_ci(loss_a: np.ndarray, loss_b: np.ndarray, **kw) -> tuple[float, float, float]:
    """CI for mean(loss_a - loss_b): negative means A is better."""
    return bootstrap_mean_ci(np.asarray(loss_a) - np.asarray(loss_b), **kw)
