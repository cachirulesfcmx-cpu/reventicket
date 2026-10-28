"""Chronological walk-forward backtesting with a locked holdout.

Protocol
1. Events are processed in date order; every model predicts *before* it sees the result.
2. The first season is warm-up only (ratings are still cold) and never scored.
3. Hyper-parameters are chosen on the development window only (`select_params` never receives
   holdout events).
4. The holdout window starts at a fixed, committed date (HOLDOUT_START) and is scored once.
5. Market probabilities use closing odds with the margin removed by the power method.
"""
from __future__ import annotations

import itertools
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Callable, Iterable

import numpy as np

from . import metrics
from .datasets import Match
from .models import AWAY, DRAW, HOME, Climatology3, EloBinary, EloDavidson, OnlinePoisson
from .odds import no_vig_power

HOLDOUT_START = {"LIGA_MX": datetime(2024, 7, 1), "NFL": datetime(2023, 9, 1)}
EDGE_THRESHOLD = 0.03

FOOTBALL_GRIDS = {
    "elo_davidson": (EloDavidson, {"k": [10, 20, 30], "home_adv": [40, 70, 100], "draw_nu": [0.8, 1.0, 1.2], "season_regress": [0.2, 0.4]}),
    "online_poisson": (OnlinePoisson, {"lr": [0.02, 0.04, 0.08], "season_regress": [0.2, 0.4]}),
}
NFL_GRID = (EloBinary, {"k": [15, 20, 25], "home_adv": [30, 48, 65], "season_regress": [0.25, 1 / 3, 0.5]})


def outcome3(m: Match) -> int:
    return HOME if m.home_score > m.away_score else DRAW if m.home_score == m.away_score else AWAY


def _grid(space: dict) -> Iterable[dict]:
    keys = list(space)
    for values in itertools.product(*(space[k] for k in keys)):
        yield dict(zip(keys, values))


def run_sequence(matches: list[Match], model, predict: Callable) -> list:
    """Predict-then-update over matches; returns the prediction made before each result."""
    preds, season = [], None
    for m in matches:
        if season is not None and m.season != season:
            model.new_season()
        season = m.season
        preds.append(predict(model, m))
        model.update(m.home, m.away, m.home_score, m.away_score)
    return preds


def _p3(model, m):
    return model.predict(m.home, m.away)


def _p2(model, m):
    return model.predict_home(m.home, m.away)


def split(matches: list[Match], holdout_start: datetime):
    first_season = matches[0].season
    scored = [i for i, m in enumerate(matches) if m.season != first_season]
    dev = [i for i in scored if matches[i].date < holdout_start]
    hold = [i for i in scored if matches[i].date >= holdout_start]
    return dev, hold


def select_params(dev_matches: list[Match], cls, space: dict, binary: bool) -> tuple[dict, float]:
    """Grid search scored on the development window only (first season = warm-up)."""
    first = dev_matches[0].season
    idx = [i for i, m in enumerate(dev_matches) if m.season != first]
    best, best_loss = None, float("inf")
    for params in _grid(space):
        preds = run_sequence(dev_matches, cls(**params), _p2 if binary else _p3)
        if binary:
            keep = [i for i in idx if dev_matches[i].home_score != dev_matches[i].away_score]
            y = np.array([1 if dev_matches[i].home_score > dev_matches[i].away_score else 0 for i in keep])
            loss = metrics.log_loss(np.array([preds[i] for i in keep]), y)
        else:
            y = np.array([outcome3(dev_matches[i]) for i in idx])
            loss = metrics.log_loss(np.vstack([preds[i] for i in idx]), y)
        if loss < best_loss:
            best, best_loss = params, loss
    return best, best_loss


@dataclass
class BetSim:
    n_bets: int
    roi: float
    roi_ci_low: float
    roi_ci_high: float
    note: str = "Flat 1u at closing odds when model - no-vig market >= threshold. Ignores limits, line availability and fees."


def bet_sim(model_p: np.ndarray, market_p: np.ndarray, odds: np.ndarray, winners: np.ndarray) -> BetSim:
    returns = []
    for p, q, o, w in zip(model_p, market_p, odds, winners):
        k = int(np.argmax(p - q))
        if p[k] - q[k] >= EDGE_THRESHOLD:
            returns.append(o[k] - 1.0 if w == k else -1.0)
    mean, lo, hi = metrics.bootstrap_mean_ci(np.array(returns)) if returns else (float("nan"),) * 3
    return BetSim(len(returns), mean, lo, hi)


def football_report(matches: list[Match], sport: str = "LIGA_MX") -> dict:
    hold_start = HOLDOUT_START[sport]
    dev_idx, hold_idx = split(matches, hold_start)
    dev_matches = [m for m in matches if m.date < hold_start]
    y_all = np.array([outcome3(m) for m in matches])
    clim = np.vstack(run_sequence(matches, Climatology3(), _p3))

    models, chosen = {}, {}
    for name, (cls, space) in FOOTBALL_GRIDS.items():
        params, dev_loss = select_params(dev_matches, cls, space, binary=False)
        chosen[name] = {"params": params, "dev_log_loss": dev_loss}
        models[name] = np.vstack(run_sequence(matches, cls(**params), _p3))

    hold = np.array(hold_idx)
    with_odds = np.array([i for i in hold_idx if matches[i].odds])
    market = {i: no_vig_power(matches[i].odds) for i in with_odds}
    y_h = y_all[hold]
    out = {
        "sport": sport, "market": "1X2 (home/draw/away)",
        "events_total": len(matches), "dev_events": len(dev_idx), "holdout_events": len(hold_idx),
        "holdout_start": hold_start.date().isoformat(), "holdout_end": matches[-1].date.date().isoformat(),
        "holdout_events_with_odds": int(len(with_odds)), "chosen_params": chosen,
        "baselines": {"climatology": {"log_loss": metrics.log_loss(clim[hold], y_h), "brier": metrics.brier(clim[hold], y_h)}},
        "models": {},
    }
    y_o = y_all[with_odds]
    mkt = np.vstack([market[i] for i in with_odds])
    out["baselines"]["market_no_vig"] = {"log_loss": metrics.log_loss(mkt, y_o), "brier": metrics.brier(mkt, y_o)}
    for name, P in models.items():
        cal_table, ece = metrics.calibration(P[hold][:, HOME], (y_h == HOME).astype(float))
        vs_clim = metrics.paired_difference_ci(metrics.per_event_log_loss(P[hold], y_h), metrics.per_event_log_loss(clim[hold], y_h))
        vs_mkt = metrics.paired_difference_ci(metrics.per_event_log_loss(P[with_odds], y_o), metrics.per_event_log_loss(mkt, y_o))
        odds_arr = np.vstack([matches[i].odds for i in with_odds])
        out["models"][name] = {
            "log_loss": metrics.log_loss(P[hold], y_h), "brier": metrics.brier(P[hold], y_h),
            "log_loss_on_odds_subset": metrics.log_loss(P[with_odds], y_o),
            "ece_home_win": ece, "calibration_home_win": [asdict(b) for b in cal_table],
            "log_loss_diff_vs_climatology": vs_clim, "log_loss_diff_vs_market": vs_mkt,
            "bet_sim": asdict(bet_sim(P[with_odds], mkt, odds_arr, y_o)),
        }
    return out


def nfl_report(matches: list[Match]) -> dict:
    hold_start = HOLDOUT_START["NFL"]
    dev_idx, hold_idx = split(matches, hold_start)
    dev_matches = [m for m in matches if m.date < hold_start]
    cls, space = NFL_GRID
    params, dev_loss = select_params(dev_matches, cls, space, binary=True)
    P = np.array(run_sequence(matches, cls(**params), _p2))
    hold = np.array([i for i in hold_idx if matches[i].home_score != matches[i].away_score])
    y = np.array([1 if matches[i].home_score > matches[i].away_score else 0 for i in hold])
    # Baseline: running home-win rate from strictly earlier seasons.
    base = []
    wins = n = 0
    for i, m in enumerate(matches):
        base.append((wins + 1) / (n + 2))
        if m.home_score != m.away_score:
            wins += m.home_score > m.away_score
            n += 1
    base = np.array(base)
    with_odds = np.array([i for i in hold if matches[i].odds])
    mkt = np.array([no_vig_power(matches[i].odds)[0] for i in with_odds])
    y_o = np.array([1 if matches[i].home_score > matches[i].away_score else 0 for i in with_odds])
    cal_table, ece = metrics.calibration(P[hold], y)
    two = lambda p: np.column_stack([p, 1 - p])  # noqa: E731
    odds_arr = np.vstack([matches[i].odds for i in with_odds])
    return {
        "sport": "NFL", "market": "moneyline (home/away), ties excluded",
        "events_total": len(matches), "dev_events": len(dev_idx), "holdout_events": int(len(hold)),
        "holdout_start": hold_start.date().isoformat(), "holdout_end": matches[-1].date.date().isoformat(),
        "holdout_events_with_odds": int(len(with_odds)),
        "chosen_params": {"elo_binary": {"params": params, "dev_log_loss": dev_loss}},
        "baselines": {
            "home_rate": {"log_loss": metrics.log_loss(base[hold], y), "brier": metrics.brier(base[hold], y)},
            "market_no_vig": {"log_loss": metrics.log_loss(mkt, y_o), "brier": metrics.brier(mkt, y_o)},
        },
        "models": {"elo_binary": {
            "log_loss": metrics.log_loss(P[hold], y), "brier": metrics.brier(P[hold], y),
            "log_loss_on_odds_subset": metrics.log_loss(P[with_odds], y_o),
            "ece_home_win": ece, "calibration_home_win": [asdict(b) for b in cal_table],
            "log_loss_diff_vs_climatology": metrics.paired_difference_ci(metrics.per_event_log_loss(P[hold], y), metrics.per_event_log_loss(base[hold], y)),
            "log_loss_diff_vs_market": metrics.paired_difference_ci(metrics.per_event_log_loss(P[with_odds], y_o), metrics.per_event_log_loss(mkt, y_o)),
            "bet_sim": asdict(bet_sim(two(P[with_odds]), two(mkt), odds_arr, 1 - y_o)),
        }},
    }
