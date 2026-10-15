import os
import json
import pytest
from fastapi.testclient import TestClient

from main import app, StrategyResponse, ChoiceCard
import state
from demo_payloads import DEMO_PAYLOADS, WATER_LEAK, WASTE_OVERFLOW, PARKING_FULL, ENERGY_SPIKE

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    """Reset state before and after each test."""
    state.reset_state()
    yield
    state.reset_state()

def test_demo_payloads_structure():
    """Verify demo_payloads contains original dicts, added dicts, and DEMO_PAYLOADS mapping."""
    assert WATER_LEAK["zone"] == "Science Block"
    assert WASTE_OVERFLOW["zone"] == "Cafeteria"
    assert PARKING_FULL["zone"] == "Main Lot"
    assert ENERGY_SPIKE["zone"] == "Lecture Hall A"

    assert "water_leak" in DEMO_PAYLOADS
    assert "waste_overflow" in DEMO_PAYLOADS
    assert "parking_full" in DEMO_PAYLOADS
    assert "energy_spike" in DEMO_PAYLOADS

    for scenario_id, (zone_key, patch) in DEMO_PAYLOADS.items():
        assert isinstance(zone_key, str)
        assert isinstance(patch, dict)

def test_get_api_state_initial_with_enriched_telemetry():
    """Test GET /api/state returns nominal baseline with all zones and enriched telemetry."""
    response = client.get("/api/state")
    assert response.status_code == 200
    data = response.json()

    assert "_meta" in data
    assert data["_meta"]["demo_mode"] is False

    # Original zones preserved
    assert "lecture_hall_a" in data
    assert "science_block" in data
    assert "cafeteria" in data
    assert "main_lot" in data

    # Enriched fields on lecture_hall_a
    assert data["lecture_hall_a"]["status"] == "normal"
    assert data["lecture_hall_a"]["co2_ppm"] == 470
    assert data["lecture_hall_a"]["temperature_c"] == 22.6
    assert data["lecture_hall_a"]["power_consumption_kw"] == 1.5

    # New zones present
    assert "library_zone_b" in data
    assert data["library_zone_b"]["co2_ppm"] == 520
    assert data["library_zone_b"]["hvac"] == "eco_mode"

    assert "cafeteria_zone_c" in data
    assert data["cafeteria_zone_c"]["co2_ppm"] == 680
    assert data["cafeteria_zone_c"]["waste_level"] == "45%"

    assert "main_auditorium" in data
    assert data["main_auditorium"]["status"] == "idle"
    assert data["main_auditorium"]["hvac"] == "standby"

def test_ingest_telemetry_update():
    """Verify POST /api/state merges live sensor telemetry from Module 1."""
    update_payload = {
        "lecture_hall_a": {
            "occupancy": 2,
            "status": "normal",
            "co2_ppm": 470,
            "temperature_c": 22.6,
            "power_consumption_kw": 1.5,
            "last_updated": "2026-10-15 12:25:00"
        },
        "library_zone_b": {
            "occupancy": 12,
            "status": "normal",
            "co2_ppm": 550,
            "temperature_c": 23.1,
            "power_consumption_kw": 2.1
        },
        "cafeteria_zone_c": {
            "occupancy": 34,
            "status": "overcrowded",
            "co2_ppm": 890,
            "temperature_c": 25.4,
            "power_consumption_kw": 4.8
        }
    }
    post_res = client.post("/api/state", json=update_payload)
    assert post_res.status_code == 200

    state_data = client.get("/api/state").json()
    assert state_data["cafeteria_zone_c"]["status"] == "overcrowded"
    assert state_data["cafeteria_zone_c"]["co2_ppm"] == 890
    assert state_data["library_zone_b"]["co2_ppm"] == 550
    assert state_data["science_block"]["status"] == "normal"  # untargeted zone preserved

def test_trigger_water_leak_sets_demo_mode_and_skips_llm():
    """
    Test POST /api/trigger/water_leak:
    - sets _meta.demo_mode to True
    - updates science_block
    - attempts Twilio SMS dispatch without crashing if keys are missing
    """
    response = client.post("/api/trigger/water_leak")
    assert response.status_code == 200
    data = response.json()

    assert data["_meta"]["demo_mode"] is True
    assert data["science_block"]["status"] == "critical"
    assert "sms_dispatch" in data
    assert data["sms_dispatch"]["status"] in ["sent", "skipped"]

    persisted = state.read_state()
    assert persisted["_meta"]["demo_mode"] is True
    assert persisted["science_block"]["status"] == "critical"

def test_trigger_all_scenarios():
    """Test POST /api/trigger/{scenario_id} for all scenarios in DEMO_PAYLOADS."""
    scenarios = ["water_leak", "waste_overflow", "parking_full", "energy_spike", "cafeteria_overcrowded"]
    for sc in scenarios:
        res = client.post(f"/api/trigger/{sc}")
        assert res.status_code == 200
        state_data = res.json()
        assert state_data["_meta"]["demo_mode"] is True
        zone_key, _ = DEMO_PAYLOADS[sc]
        assert zone_key in state_data
        assert state_data[zone_key]["status"] != "normal"

def test_trigger_invalid_scenario_404():
    """Verify unknown scenario returns 404."""
    response = client.post("/api/trigger/unknown_anomaly")
    assert response.status_code == 404

def test_post_reset_restores_baseline():
    """Test POST /api/reset restores baseline and sets _meta.demo_mode back to False."""
    client.post("/api/trigger/energy_spike")
    assert client.get("/api/state").json()["_meta"]["demo_mode"] is True

    reset_res = client.post("/api/reset")
    assert reset_res.status_code == 200
    reset_data = reset_res.json()

    assert reset_data["_meta"]["demo_mode"] is False
    assert reset_data["lecture_hall_a"]["status"] == "normal"
    assert reset_data["library_zone_b"]["co2_ppm"] == 520

    persisted = client.get("/api/state").json()
    assert persisted["_meta"]["demo_mode"] is False
    assert persisted["lecture_hall_a"]["status"] == "normal"
    assert "main_auditorium" in persisted

def test_generate_strategy_pydantic_schema():
    """
    Test POST /api/generate_strategy:
    - accepts body {"zone_id": str}
    - validates with Pydantic v2
    - returns diagnostic string
    - exactly 3 choices
    - each choice has chart_data of exactly 5 ints
    """
    response = client.post(
        "/api/generate_strategy",
        json={"zone_id": "lecture_hall_a"}
    )
    assert response.status_code == 200
    data = response.json()

    validated = StrategyResponse.model_validate(data)
    assert isinstance(validated.diagnostic, str) and len(validated.diagnostic) > 0
    assert len(validated.choices) == 3

    for choice in validated.choices:
        assert isinstance(choice.id, str)
        assert isinstance(choice.title, str)
        assert isinstance(choice.description, str)
        assert len(choice.chart_data) == 5
        assert all(isinstance(x, int) for x in choice.chart_data)

def test_generate_strategy_all_zones_fallback_compliance():
    """Verify fallback strategies for all zones (including new zones) match exact Pydantic schema."""
    zones = [
        "lecture_hall_a",
        "science_block",
        "cafeteria",
        "main_lot",
        "library_zone_b",
        "cafeteria_zone_c",
        "main_auditorium",
        "custom_zone"
    ]
    for z in zones:
        res = client.post("/api/generate_strategy", json={"zone_id": z})
        assert res.status_code == 200
        val = StrategyResponse.model_validate(res.json())
        assert len(val.choices) == 3
        for c in val.choices:
            assert len(c.chart_data) == 5

def test_cors_middleware():
    """Verify CORS middleware is active."""
    response = client.options(
        "/api/state",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in ["*", "http://localhost:3000"]
    assert "access-control-allow-methods" in response.headers
