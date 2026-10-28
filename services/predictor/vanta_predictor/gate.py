"""Promotion gate. A model may be *proposed* for publication only if every automatic check
passes; publication additionally requires explicit human approval recorded in model_versions."""
from __future__ import annotations

CRITERIA = {
    "min_holdout_events": 300,
    "max_ece": 0.03,
    "min_bets_for_edge_claim": 200,
}


def evaluate_gate(report: dict, model: str) -> dict:
    m = report["models"][model]
    checks = []

    def add(name: str, ok: bool, detail: str) -> None:
        checks.append({"check": name, "passed": bool(ok), "detail": detail})

    add("sample_size", report["holdout_events"] >= CRITERIA["min_holdout_events"],
        f"{report['holdout_events']} holdout events (min {CRITERIA['min_holdout_events']})")
    _, _, hi = m["log_loss_diff_vs_climatology"]
    add("beats_naive_baseline", hi < 0, f"log-loss diff vs baseline 95% CI upper = {hi:+.4f} (must be < 0)")
    add("calibrated", m["ece_home_win"] <= CRITERIA["max_ece"], f"ECE = {m['ece_home_win']:.4f} (max {CRITERIA['max_ece']})")
    mean, lo, hi = m["log_loss_diff_vs_market"]
    add("market_parity", hi <= 0, f"log-loss diff vs no-vig market = {mean:+.4f} [{lo:+.4f}, {hi:+.4f}] (upper must be <= 0)")
    b = m["bet_sim"]
    add("positive_edge_evidence", b["n_bets"] >= CRITERIA["min_bets_for_edge_claim"] and (b["roi_ci_low"] or -1) > 0,
        f"{b['n_bets']} simulated bets, ROI {b['roi']:+.3f} [CI {b['roi_ci_low']:+.3f}, {b['roi_ci_high']:+.3f}] (lower bound must be > 0)")
    automatic = all(c["passed"] for c in checks)
    return {
        "model": model, "sport": report["sport"], "checks": checks,
        "automatic_checks_passed": automatic,
        "publication_allowed": False,  # always requires explicit human approval + licensed live data
        "status": "candidate_pending_human_approval" if automatic else "experimental_not_publishable",
    }
