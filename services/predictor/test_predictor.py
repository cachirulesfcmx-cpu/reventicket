from datetime import datetime, timedelta

import numpy as np
import pytest

from vanta_predictor import backtest, metrics, odds
from vanta_predictor.datasets import Match, parse_football_data, parse_nflverse
from vanta_predictor.gate import evaluate_gate
from vanta_predictor.models import EloBinary, EloDavidson, OnlinePoisson


# ----------------------------------------------------------------- odds
def test_no_vig_methods_sum_to_one_and_keep_order():
    o = [1.5, 4.2, 6.5]
    for f in (odds.no_vig_proportional, odds.no_vig_power):
        p = f(o)
        assert abs(p.sum() - 1) < 1e-9 and p[0] > p[1] > p[2]
    assert odds.overround(o) > 0


def test_power_method_shifts_mass_toward_favourite():
    o = [1.25, 5.0, 12.0]
    assert odds.no_vig_power(o)[0] > odds.no_vig_proportional(o)[0]


@pytest.mark.parametrize("bad", [[1.0, 2.0], [2.0], [float("nan"), 2.0], [-3, 2]])
def test_invalid_odds_rejected(bad):
    with pytest.raises(ValueError):
        odds.implied(bad)


def test_american_odds():
    assert odds.american_to_decimal(150) == 2.5
    assert abs(odds.american_to_decimal(-200) - 1.5) < 1e-12
    with pytest.raises(ValueError):
        odds.american_to_decimal(0)


def test_expected_value():
    assert abs(odds.expected_value(0.5, 2.2) - 0.1) < 1e-12
    with pytest.raises(ValueError):
        odds.expected_value(1.2, 2.0)


# ----------------------------------------------------------------- metrics
def test_perfect_and_uniform_forecasts():
    y = np.array([0, 1, 2])
    assert metrics.brier(np.eye(3), y) == 0
    uni = np.full((3, 3), 1 / 3)
    assert abs(metrics.log_loss(uni, y) - np.log(3)) < 1e-12
    assert abs(metrics.brier(np.array([0.5, 0.5]), np.array([1, 0])) - 0.25) < 1e-12


def test_calibration_perfect():
    rng = np.random.default_rng(0)
    p = rng.uniform(size=20000)
    y = rng.uniform(size=p.size) < p
    _, ece = metrics.calibration(p, y)
    assert ece < 0.02


def test_bootstrap_ci_contains_mean():
    m, lo, hi = metrics.bootstrap_mean_ci(np.array([1.0, 2.0, 3.0, 4.0]))
    assert lo <= m <= hi


# ----------------------------------------------------------------- models
def test_models_output_valid_distributions():
    for model in (EloDavidson(), OnlinePoisson()):
        p = model.predict("A", "B")
        assert p.shape == (3,) and abs(p.sum() - 1) < 1e-9 and (p > 0).all()
    assert 0.5 < EloBinary().predict_home("A", "B") < 1  # home advantage


def test_ratings_move_toward_winner_and_regress():
    m = EloDavidson()
    for _ in range(10):
        m.update("A", "B", 3, 0)
    assert m.ratings["A"] > 1500 > m.ratings["B"]
    before = m.ratings["A"]
    m.new_season()
    assert 1500 < m.ratings["A"] < before


def _synthetic(n_seasons=6, per_season=120, seed=1):
    """Synthetic league with hidden team strengths (tests only)."""
    rng = np.random.default_rng(seed)
    teams = [f"T{i}" for i in range(10)]
    strength = dict(zip(teams, rng.normal(0, 0.4, len(teams))))
    out, d = [], datetime(2015, 1, 1)
    for s in range(n_seasons):
        for _ in range(per_season):
            h, a = rng.choice(teams, 2, replace=False)
            lh, la = np.exp(0.25 + strength[h] - strength[a]), np.exp(strength[a] - strength[h])
            out.append(Match(d, str(2015 + s), h, a, int(rng.poisson(lh)), int(rng.poisson(la)), (2.0, 3.4, 3.8)))
            d += timedelta(days=1)
    return out


def test_predictions_never_use_the_result_they_predict():
    ms = _synthetic()
    preds_a = backtest.run_sequence(ms, EloDavidson(), backtest._p3)
    changed = list(ms)
    changed[500] = Match(ms[500].date, ms[500].season, ms[500].home, ms[500].away, 9, 0, ms[500].odds)
    preds_b = backtest.run_sequence(changed, EloDavidson(), backtest._p3)
    assert np.allclose(preds_a[500], preds_b[500])  # same prediction for the altered event
    assert not np.allclose(preds_a[501:], preds_b[501:])  # only later events are affected


def test_models_learn_signal_on_synthetic_data():
    ms = _synthetic()
    y = np.array([backtest.outcome3(m) for m in ms])
    late = slice(400, None)
    clim = np.vstack(backtest.run_sequence(ms, backtest.Climatology3(), backtest._p3))
    pois = np.vstack(backtest.run_sequence(ms, OnlinePoisson(), backtest._p3))
    assert metrics.log_loss(pois[late], y[late]) < metrics.log_loss(clim[late], y[late])


def test_parameter_selection_never_sees_holdout(monkeypatch):
    ms = _synthetic()
    holdout_start = ms[600].date
    seen = []
    real = backtest.run_sequence

    def spy(matches, model, predict):
        seen.append(max(m.date for m in matches))
        return real(matches, model, predict)

    monkeypatch.setattr(backtest, "run_sequence", spy)
    backtest.select_params([m for m in ms if m.date < holdout_start], EloDavidson, {"k": [10, 20]}, binary=False)
    assert seen and max(seen) < holdout_start


def test_split_excludes_warmup_season():
    ms = _synthetic()
    dev, hold = backtest.split(ms, ms[600].date)
    assert min(dev) == 120 and min(hold) == 600 and not set(dev) & set(hold)


# ----------------------------------------------------------------- data parsing
def test_football_data_parser_skips_unplayed_and_bad_odds():
    csv = "﻿Country,League,Season,Date,Time,Home,Away,HG,AG,Res,PSCH,PSCD,PSCA\n" \
          "Mexico,Liga MX,2024/2025,05/07/2024,02:00,Puebla,Tigres,1,2,A,4.1,3.6,1.9\n" \
          "Mexico,Liga MX,2024/2025,06/07/2024,02:00,Leon,Toluca,,,,2.2,3.3,3.2\n" \
          "Mexico,Liga MX,2024/2025,07/07/2024,02:00,Pachuca,Santos,2,2,D,0.9,,3.0\n"
    ms = parse_football_data(csv)
    assert len(ms) == 2 and ms[0].odds == (4.1, 3.6, 1.9) and ms[1].odds is None


def test_nflverse_parser_regular_season_only():
    csv = "game_id,season,game_type,gameday,away_team,away_score,home_team,home_score,away_moneyline,home_moneyline\n" \
          "a,2024,REG,2024-09-08,BUF,20,KC,27,150,-170\n" \
          "b,2024,POST,2025-01-12,BUF,20,KC,27,150,-170\n" \
          "c,2025,REG,2025-09-07,BUF,,KC,,,\n"
    ms = parse_nflverse(csv)
    assert len(ms) == 1 and ms[0].odds[1] == 2.5


# ----------------------------------------------------------------- gate
def _report(diff_mkt_hi, roi_lo, ece=0.01, n=500):
    return {"sport": "TEST", "holdout_events": n, "models": {"m": {
        "log_loss_diff_vs_climatology": (-0.05, -0.07, -0.03), "ece_home_win": ece,
        "log_loss_diff_vs_market": (diff_mkt_hi - 0.01, diff_mkt_hi - 0.02, diff_mkt_hi),
        "bet_sim": {"n_bets": 400, "roi": 0.02, "roi_ci_low": roi_lo, "roi_ci_high": 0.05}}}}


def test_gate_blocks_models_worse_than_market_or_without_edge():
    assert evaluate_gate(_report(0.01, 0.01), "m")["status"] == "experimental_not_publishable"
    assert evaluate_gate(_report(-0.001, -0.01), "m")["status"] == "experimental_not_publishable"
    assert evaluate_gate(_report(-0.001, 0.01, ece=0.05), "m")["status"] == "experimental_not_publishable"
    assert evaluate_gate(_report(-0.001, 0.01, n=100), "m")["status"] == "experimental_not_publishable"


def test_gate_never_auto_publishes():
    g = evaluate_gate(_report(-0.001, 0.01), "m")
    assert g["automatic_checks_passed"] is True
    assert g["publication_allowed"] is False and g["status"] == "candidate_pending_human_approval"
