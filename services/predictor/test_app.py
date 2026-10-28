from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True and r.json()["mode"] == "research-only"


def test_metrics_math():
    r = client.post("/metrics", json={"sport": "NBA", "model_probability": 0.6, "decimal_odds": 2.0, "market_probability_no_vig": 0.55})
    assert r.status_code == 200
    assert abs(r.json()["edge"] - 0.05) < 1e-9
    assert abs(r.json()["expected_value_per_unit_before_costs"] - 0.2) < 1e-9


def test_reject_invalid_inputs():
    assert client.post("/metrics", json={"sport": "NBA", "model_probability": 1.5}).status_code == 422
    assert client.post("/metrics", json={"sport": "CRICKET", "model_probability": 0.5}).status_code == 422
    assert client.post("/odds/no-vig", json={"decimal_odds": [1.0, 2.0]}).status_code == 422
    assert client.post("/odds/no-vig", json={"decimal_odds": [2.0]}).status_code == 422


def test_no_vig_endpoint():
    r = client.post("/odds/no-vig", json={"decimal_odds": [1.91, 1.91]}).json()
    assert abs(sum(r["probabilities"]) - 1) < 1e-9 and r["overround"] > 0


def test_publication_never_enabled(monkeypatch):
    monkeypatch.setenv("PREDICTIONS_ENABLED", "true")
    body = client.get("/sports").json()
    assert body["publication_enabled"] is False and body["flag_requested"] is True
    assert client.get("/research/reports").json()["publication_enabled"] is False
