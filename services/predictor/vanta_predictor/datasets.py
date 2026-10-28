"""Historical datasets for offline research. Files are downloaded to a local cache that is
git-ignored; they are never redistributed by the product. Review each source's terms before
any commercial use."""
from __future__ import annotations

import csv
import io
import os
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

CACHE = Path(os.environ.get("VANTA_DATA_CACHE", Path(__file__).resolve().parent.parent / ".data-cache"))

SOURCES = {
    "LIGA_MX": {
        "url": "https://www.football-data.co.uk/new/MEX.csv",
        "provider": "football-data.co.uk",
        "terms": "Free historical results/odds; confirm licence before commercial use.",
    },
    "NFL": {
        "url": "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv",
        "provider": "nflverse/nfldata",
        "terms": "Community dataset; confirm licence and attribution before commercial use.",
    },
}


@dataclass(frozen=True)
class Match:
    date: datetime
    season: str
    home: str
    away: str
    home_score: int
    away_score: int
    odds: tuple[float, ...] | None  # football: (H, D, A) closing; NFL: (home, away) decimal


def fetch(sport: str, refresh: bool = False) -> Path:
    src = SOURCES[sport]
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{sport.lower()}.csv"
    if refresh or not path.exists():
        req = urllib.request.Request(src["url"], headers={"User-Agent": "vanta-edge-research/0.2"})
        with urllib.request.urlopen(req, timeout=60) as r:  # noqa: S310 - fixed allowlisted URLs
            path.write_bytes(r.read())
    return path


def _float(v: str | None) -> float | None:
    try:
        f = float(v) if v not in (None, "") else None
    except ValueError:
        return None
    return f if f is not None and f > 1.0 else None


def parse_football_data(text: str) -> list[Match]:
    rows = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    out: list[Match] = []
    for r in rows:
        try:
            date = datetime.strptime(r["Date"], "%d/%m/%Y")
            hg, ag = int(r["HG"]), int(r["AG"])
        except (KeyError, ValueError, TypeError):
            continue  # unplayed / malformed rows are skipped, never imputed
        odds = tuple(_float(r.get(k)) for k in ("PSCH", "PSCD", "PSCA"))
        out.append(Match(date, r["Season"], r["Home"].strip(), r["Away"].strip(), hg, ag,
                         odds if all(odds) else None))
    out.sort(key=lambda m: m.date)
    return out


def parse_nflverse(text: str) -> list[Match]:
    from .odds import american_to_decimal

    out: list[Match] = []
    for r in csv.DictReader(io.StringIO(text)):
        if r.get("game_type") != "REG" or r.get("home_score") in ("", None):
            continue
        try:
            date = datetime.strptime(r["gameday"], "%Y-%m-%d")
            hs, as_ = int(r["home_score"]), int(r["away_score"])
        except ValueError:
            continue
        odds = None
        try:
            if r.get("home_moneyline") and r.get("away_moneyline"):
                odds = (american_to_decimal(float(r["home_moneyline"])), american_to_decimal(float(r["away_moneyline"])))
        except ValueError:
            odds = None
        out.append(Match(date, r["season"], r["home_team"], r["away_team"], hs, as_, odds))
    out.sort(key=lambda m: m.date)
    return out


def load(sport: str) -> list[Match]:
    text = fetch(sport).read_text(encoding="utf-8", errors="replace")
    return parse_football_data(text) if sport == "LIGA_MX" else parse_nflverse(text)
