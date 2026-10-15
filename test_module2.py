from fastapi.testclient import TestClient

from demo_payloads import DEMO_PAYLOADS
from main import app

client = TestClient(app)

ZONES = {"lecture_hall_a", "science_block", "cafeteria", "main_lot"}
STATUSES = {"normal", "low", "warning", "critical"}
SCENARIOS = ["water_leak", "waste_overflow", "parking_full", "energy_spike"]


def setup_function(function):
    client.post("/api/reset")


def teardown_module(module):
    # Leave state.json at baseline so pytest never dirties the repo
    client.post("/api/reset")


def get_state():
    res = client.get("/api/state")
    assert res.status_code == 200
    return res.json()


def test_demo_payloads_structure():
    for sc in SCENARIOS:
        assert sc in DEMO_PAYLOADS
        zone_key, patch = DEMO_PAYLOADS[sc]
        assert zone_key in ZONES
        assert patch["status"] in STATUSES


def test_baseline_state_has_only_contract_zones():
    data = get_state()
    assert set(data.keys()) == ZONES | {"_meta"}
    assert data["_meta"]["demo_mode"] is False
    assert data["lecture_hall_a"]["occupancy"] == 30
    for zone in ZONES:
        assert data[zone]["status"] == "normal"


def test_trigger_each_scenario_updates_state():
    for sc in SCENARIOS:
        res = client.post(f"/api/trigger/{sc}")
        assert res.status_code == 200
        data = get_state()
        zone_key, patch = DEMO_PAYLOADS[sc]
        assert data["_meta"]["demo_mode"] is True
        assert data[zone_key]["status"] == patch["status"]
        assert set(data.keys()) == ZONES | {"_meta"}
        for zone in ZONES:
            assert data[zone]["status"] in STATUSES


def test_water_leak_is_critical_and_skips_llm():
    res = client.post("/api/trigger/water_leak")
    assert res.status_code == 200
    assert "sms_dispatch" in res.json()
    assert get_state()["science_block"]["status"] == "critical"


def test_invalid_scenario_404():
    assert client.post("/api/trigger/not_a_scenario").status_code == 404


def test_reset_restores_baseline_and_clears_demo_mode():
    client.post("/api/trigger/energy_spike")
    assert get_state()["_meta"]["demo_mode"] is True
    res = client.post("/api/reset")
    assert res.status_code == 200
    data = get_state()
    assert data["_meta"]["demo_mode"] is False
    assert data["lecture_hall_a"]["occupancy"] == 30
    for zone in ZONES:
        assert data[zone]["status"] == "normal"


def test_generate_strategy_schema_for_every_zone():
    for zone in ZONES:
        res = client.post("/api/generate_strategy", json={"zone_id": zone})
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body["diagnostic"], str) and body["diagnostic"]
        assert len(body["choices"]) == 3
        for choice in body["choices"]:
            assert isinstance(choice["id"], str)
            assert isinstance(choice["title"], str)
            assert isinstance(choice["description"], str)
            assert len(choice["chart_data"]) == 5
            assert all(isinstance(v, int) for v in choice["chart_data"])


def test_post_api_state_is_not_accepted():
    # Module 1 writes state.json directly; no endpoint may add zones
    res = client.post("/api/state", json={"extra_zone": {"status": "overcrowded"}})
    assert res.status_code != 200


def test_cors_allows_frontend_origin():
    res = client.options(
        "/api/state",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
