"""Data-quality guards applied before any feature or prediction is computed."""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Sequence

import numpy as np


class DataQualityError(ValueError):
    """Raised when inputs are missing, stale or out of range; callers must not predict."""


def require_fresh(observed_at: datetime | None, now: datetime, max_age: timedelta) -> None:
    if observed_at is None:
        raise DataQualityError("missing_timestamp")
    if observed_at.tzinfo is None:
        raise DataQualityError("naive_timestamp")
    if observed_at > now + timedelta(minutes=5):
        raise DataQualityError("timestamp_in_future")
    if now - observed_at > max_age:
        raise DataQualityError("stale_data")


def require_before_cutoff(observed_at: datetime, cutoff: datetime) -> None:
    """Leakage guard: a feature observed after the prediction cutoff cannot be used."""
    if observed_at > cutoff:
        raise DataQualityError("observed_after_cutoff")


def validate_probabilities(p: Sequence[float], tol: float = 1e-6) -> np.ndarray:
    arr = np.asarray(p, dtype=float)
    if arr.ndim != 1 or arr.size < 2 or not np.all(np.isfinite(arr)):
        raise DataQualityError("invalid_probability_vector")
    if np.any(arr < 0) or np.any(arr > 1) or abs(arr.sum() - 1) > tol:
        raise DataQualityError("probabilities_out_of_range")
    return arr


def validate_score(value: int | None, sport: str) -> int:
    limits = {"LIGA_MX": 20, "UCL": 20, "LALIGA": 20, "NFL": 100, "MLB": 40, "NBA": 250}
    if value is None:
        raise DataQualityError("missing_score")
    if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > limits.get(sport, 300):
        raise DataQualityError("score_out_of_range")
    return value


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_finite_number(x: object) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x))
