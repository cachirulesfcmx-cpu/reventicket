"""Online ("predict, then update") baseline models. Each model only ever sees results that
happened before the event it is predicting, which removes look-ahead leakage by construction."""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import numpy as np

# Outcome encoding for 3-way football markets.
HOME, DRAW, AWAY = 0, 1, 2


@dataclass
class Climatology3:
    """Baseline: historical frequency of home/draw/away seen so far (Laplace-smoothed)."""
    counts: Counter = field(default_factory=lambda: Counter({HOME: 1, DRAW: 1, AWAY: 1}))

    def predict(self, home: str, away: str) -> np.ndarray:
        total = sum(self.counts.values())
        return np.array([self.counts[HOME], self.counts[DRAW], self.counts[AWAY]], dtype=float) / total

    def update(self, home: str, away: str, hg: int, ag: int) -> None:
        self.counts[HOME if hg > ag else DRAW if hg == ag else AWAY] += 1

    def new_season(self) -> None:
        pass


@dataclass
class EloDavidson:
    """Elo ratings with Davidson's tie model for 3-way outcomes."""
    k: float = 20.0
    home_adv: float = 60.0
    draw_nu: float = 0.9
    season_regress: float = 0.25
    mean: float = 1500.0
    ratings: dict = field(default_factory=lambda: defaultdict(lambda: 1500.0))

    def predict(self, home: str, away: str) -> np.ndarray:
        ph = 10 ** ((self.ratings[home] + self.home_adv) / 400)
        pa = 10 ** (self.ratings[away] / 400)
        pd = self.draw_nu * math.sqrt(ph * pa)
        s = ph + pa + pd
        return np.array([ph / s, pd / s, pa / s])

    def update(self, home: str, away: str, hg: int, ag: int) -> None:
        p = self.predict(home, away)
        expected = p[HOME] + 0.5 * p[DRAW]
        actual = 1.0 if hg > ag else 0.5 if hg == ag else 0.0
        mov = math.log(abs(hg - ag) + 1) + 1.0
        delta = self.k * mov * (actual - expected)
        self.ratings[home] += delta
        self.ratings[away] -= delta

    def new_season(self) -> None:
        for t in list(self.ratings):
            self.ratings[t] = self.mean + (self.ratings[t] - self.mean) * (1 - self.season_regress)


@dataclass
class OnlinePoisson:
    """Independent Poisson goals with online attack/defence ratings (log-linear, SGD updates)."""
    lr: float = 0.05
    season_regress: float = 0.3
    mu: float = math.log(1.3)
    home: float = 0.25
    max_goals: int = 10
    att: dict = field(default_factory=lambda: defaultdict(float))
    dfn: dict = field(default_factory=lambda: defaultdict(float))

    def rates(self, home: str, away: str) -> tuple[float, float]:
        lh = math.exp(self.mu + self.home + self.att[home] - self.dfn[away])
        la = math.exp(self.mu + self.att[away] - self.dfn[home])
        return lh, la

    def score_matrix(self, home: str, away: str) -> np.ndarray:
        lh, la = self.rates(home, away)
        g = np.arange(self.max_goals + 1)
        fact = np.array([math.factorial(int(i)) for i in g], dtype=float)
        ph = np.exp(-lh) * lh ** g / fact
        pa = np.exp(-la) * la ** g / fact
        m = np.outer(ph, pa)
        return m / m.sum()

    def predict(self, home: str, away: str) -> np.ndarray:
        m = self.score_matrix(home, away)
        return np.array([np.tril(m, -1).sum(), np.trace(m), np.triu(m, 1).sum()])

    def prob_over(self, home: str, away: str, line: float = 2.5) -> float:
        m = self.score_matrix(home, away)
        i, j = np.indices(m.shape)
        return float(m[(i + j) > line].sum())

    def update(self, home: str, away: str, hg: int, ag: int) -> None:
        lh, la = self.rates(home, away)
        rh, ra = hg - lh, ag - la
        self.att[home] += self.lr * rh
        self.dfn[away] -= self.lr * rh
        self.att[away] += self.lr * ra
        self.dfn[home] -= self.lr * ra
        self.mu += self.lr * 0.02 * (rh + ra)
        self.home += self.lr * 0.02 * rh

    def new_season(self) -> None:
        for d in (self.att, self.dfn):
            for t in list(d):
                d[t] *= 1 - self.season_regress


@dataclass
class EloBinary:
    """Two-outcome Elo (NFL/NBA/MLB style) with margin-of-victory multiplier and season regression."""
    k: float = 20.0
    home_adv: float = 48.0
    season_regress: float = 1 / 3
    mean: float = 1505.0
    ratings: dict = field(default_factory=lambda: defaultdict(lambda: 1505.0))

    def predict_home(self, home: str, away: str) -> float:
        diff = self.ratings[home] + self.home_adv - self.ratings[away]
        return 1.0 / (1.0 + 10 ** (-diff / 400))

    def update(self, home: str, away: str, hs: int, as_: int) -> None:
        p = self.predict_home(home, away)
        actual = 1.0 if hs > as_ else 0.5 if hs == as_ else 0.0
        winner_diff = (self.ratings[home] + self.home_adv - self.ratings[away]) * (1 if hs >= as_ else -1)
        mov = math.log(abs(hs - as_) + 1) * 2.2 / (winner_diff * 0.001 + 2.2)
        delta = self.k * mov * (actual - p)
        self.ratings[home] += delta
        self.ratings[away] -= delta

    def new_season(self) -> None:
        for t in list(self.ratings):
            self.ratings[t] = self.mean + (self.ratings[t] - self.mean) * (1 - self.season_regress)
