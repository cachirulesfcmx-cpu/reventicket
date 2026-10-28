"""CLI: python -m vanta_predictor.research [LIGA_MX|NFL] -> reports/<sport>.json"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from . import __version__, datasets
from .backtest import football_report, nfl_report
from .gate import evaluate_gate

OUT = Path(__file__).resolve().parent.parent / "reports"


def main(argv: list[str]) -> int:
    sports = argv or ["LIGA_MX", "NFL"]
    OUT.mkdir(exist_ok=True)
    for sport in sports:
        t0 = time.time()
        matches = datasets.load(sport)
        report = football_report(matches, sport) if sport == "LIGA_MX" else nfl_report(matches)
        report["gates"] = [evaluate_gate(report, name) for name in report["models"]]
        report["source"] = {k: v for k, v in datasets.SOURCES[sport].items() if k != "url"} | {"url": datasets.SOURCES[sport]["url"]}
        report["generated_by"] = f"vanta_predictor {__version__}"
        report["runtime_seconds"] = round(time.time() - t0, 1)
        (OUT / f"{sport.lower()}.json").write_text(json.dumps(report, indent=2, default=float))
        print(f"{sport}: holdout={report['holdout_events']} " + " | ".join(
            f"{g['model']}: {g['status']}" for g in report["gates"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
