"""VANTA EDGE predictor API. Research utilities only: it never publishes picks."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from vanta_predictor import __version__
from vanta_predictor.gate import CRITERIA
from vanta_predictor.odds import no_vig_power, no_vig_proportional, overround

app = FastAPI(title="VANTA EDGE Predictor", version=__version__,
              description="Baseline probability utilities and research reports. Publication is disabled.")
Sport = Literal["LIGA_MX", "UCL", "LALIGA", "NFL", "MLB", "NBA"]
REPORTS = Path(__file__).resolve().parent / "reports"


def publication_enabled() -> bool:
    # Even if the env flag is set, the API never publishes; the web layer reads approved rows only.
    return os.environ.get("PREDICTIONS_ENABLED", "false").lower() == "true"


class ProbabilityInput(BaseModel):
    sport: Sport
    model_probability: float = Field(ge=0, le=1)
    decimal_odds: float | None = Field(default=None, gt=1)
    market_probability_no_vig: float | None = Field(default=None, ge=0, le=1)


class OddsInput(BaseModel):
    decimal_odds: list[float] = Field(min_length=2, max_length=20)
    method: Literal["power", "proportional"] = "power"


@app.get("/health")
def health():
    return {"ok": True, "service": "vanta-edge-predictor", "version": __version__, "mode": "research-only",
            "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/sports")
def sports():
    return {"sports": ["LIGA_MX", "UCL", "LALIGA", "NFL", "MLB", "NBA"], "publication_enabled": False,
            "flag_requested": publication_enabled()}


@app.post("/metrics")
def metrics(payload: ProbabilityInput):
    """Transparent arithmetic only; does not endorse or publish a pick."""
    p = payload.model_probability
    edge = None if payload.market_probability_no_vig is None else p - payload.market_probability_no_vig
    ev = None if payload.decimal_odds is None else p * payload.decimal_odds - 1
    return {"sport": payload.sport, "model_probability": p, "market_probability_no_vig": payload.market_probability_no_vig,
            "edge": edge, "expected_value_per_unit_before_costs": ev, "is_prediction": False,
            "note": "Arithmetic helper only. Model quality and calibration are not assessed."}


@app.post("/odds/no-vig")
def odds_no_vig(payload: OddsInput):
    try:
        probs = (no_vig_power if payload.method == "power" else no_vig_proportional)(payload.decimal_odds)
        return {"method": payload.method, "overround": overround(payload.decimal_odds), "probabilities": [float(x) for x in probs]}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None


@app.get("/research/reports")
def research_reports():
    """Latest offline backtest summaries (research only, never picks)."""
    out = []
    for f in sorted(REPORTS.glob("*.json")):
        r = json.loads(f.read_text())
        out.append({"sport": r["sport"], "market": r["market"], "holdout": [r["holdout_start"], r["holdout_end"]],
                    "holdout_events": r["holdout_events"], "gates": r["gates"], "baselines": r["baselines"],
                    "models": {k: {x: v[x] for x in ("log_loss", "brier", "ece_home_win", "bet_sim")} for k, v in r["models"].items()}})
    return {"criteria": CRITERIA, "reports": out, "publication_enabled": False}
