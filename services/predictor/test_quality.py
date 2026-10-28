from datetime import datetime, timedelta, timezone

import pytest

from vanta_predictor.odds import edge, expected_value, no_vig_power
from vanta_predictor.quality import (
    DataQualityError, is_finite_number, require_before_cutoff, require_fresh, validate_probabilities, validate_score,
)

NOW = datetime(2026, 10, 28, 18, 0, tzinfo=timezone.utc)


def test_fresh_data_passes_and_stale_fails():
    require_fresh(NOW - timedelta(minutes=10), NOW, timedelta(hours=1))
    with pytest.raises(DataQualityError, match="stale_data"):
        require_fresh(NOW - timedelta(hours=7), NOW, timedelta(hours=6))


@pytest.mark.parametrize("ts,code", [
    (None, "missing_timestamp"),
    (datetime(2026, 10, 28, 17, 0), "naive_timestamp"),
    (NOW + timedelta(hours=1), "timestamp_in_future"),
])
def test_bad_timestamps(ts, code):
    with pytest.raises(DataQualityError, match=code):
        require_fresh(ts, NOW, timedelta(hours=1))


def test_leakage_guard():
    require_before_cutoff(NOW - timedelta(seconds=1), NOW)
    with pytest.raises(DataQualityError, match="observed_after_cutoff"):
        require_before_cutoff(NOW + timedelta(minutes=1), NOW)  # e.g. lineup published after kickoff


@pytest.mark.parametrize("p", [[0.5], [0.6, 0.6], [-0.1, 1.1], [float("nan"), 0.5], [[0.5, 0.5]]])
def test_invalid_probability_vectors(p):
    with pytest.raises(DataQualityError):
        validate_probabilities(p)


def test_valid_probability_vector_from_market():
    assert validate_probabilities(no_vig_power([2.1, 3.4, 3.6])).sum() == pytest.approx(1)


@pytest.mark.parametrize("v,sport", [(None, "NBA"), (-1, "NFL"), (99, "LIGA_MX"), (True, "MLB"), (2.5, "NBA")])
def test_out_of_range_scores(v, sport):
    with pytest.raises(DataQualityError):
        validate_score(v, sport)


def test_edge_and_ev_sign():
    assert edge(0.55, 0.5) == pytest.approx(0.05)
    assert expected_value(0.4, 2.0) == pytest.approx(-0.2)  # 40 % at even odds loses 0.2 per unit
    assert is_finite_number(1.5) and not is_finite_number(float("inf")) and not is_finite_number("1")
