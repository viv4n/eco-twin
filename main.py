import os
import json
import copy
import time
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import demo_payloads

STATE_FILE = "state.json"
TEMP_STATE_FILE = "state.json.tmp"
DEMO_MODE_FILE = "demo_mode.txt"
SCENARIO_TRIGGER_FILE = "active_scenario.txt"

app = FastAPI(
    title="EcoTwin DSU Campus IoT Backend",
    description="Real-Time Digital Twin Telemetry Engine",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_current_state() -> dict:
    """Reads directly from state.json on every request to prevent caching issues."""
    if not os.path.exists(STATE_FILE):
        return copy.deepcopy(demo_payloads.BASELINE_STATE)
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return copy.deepcopy(demo_payloads.BASELINE_STATE)


@app.get("/")
def root():
    return {
        "service": "EcoTwin DSU Campus API",
        "status": "online",
        "zones_count": len(demo_payloads.BASELINE_STATE)
    }


# Primary Full-State Spatial Mirror Endpoint (Returns Record<string, BackendZoneData>)
@app.get("/api/v1/telemetry/state")
@app.get("/api/state")
def get_full_telemetry_state():
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    state = load_current_state()
    return JSONResponse(content=state, headers=headers)


# Summary Overview Endpoint (Returns CampusHealthScore + triggeredZoneIds + Full Zone Dictionary)
@app.get("/api/v1/telemetry/overview")
def get_telemetry_overview():
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    state = load_current_state()
    triggered_ids = [k for k, v in state.items() if v.get("status") in ["critical", "warning", "critical_waste"]]

    health_score = max(100 - (len(triggered_ids) * 12), 45)

    recent_activities = []
    for zone_id in triggered_ids:
        zone = state.get(zone_id, {})
        recent_activities.append({
            "id": f"act-{int(time.time() * 1000) % 10000}",
            "zoneId": zone_id,
            "severity": zone.get("status", "warning"),
            "message": f"Anomaly detected in {zone.get('name', zone_id)}",
            "timestamp": time.strftime("%H:%M")
        })

    payload = {
        "campusHealthScore": health_score,
        "subsystemScores": {
            "buildings": 92,
            "energy": 76 if any(z in triggered_ids for z in ["soe_center_of_engineering", "main_server_room"]) else 95,
            "environment": 89,
            "security": 85,
            "facilities": 60 if "pipe_junction_bwssb_1" in triggered_ids else 90,
            "transport": 78 if "parking_3" in triggered_ids else 95
        },
        "triggeredZoneIds": triggered_ids,
        "recentActivity": recent_activities,
        # Full 36-zone spatial dictionary attached here for easy context destructuring
        "zones": state
    }
    return JSONResponse(content=payload, headers=headers)


# Zone Diagnostic Endpoint for Strategy Drawer
@app.get("/api/v1/telemetry/zones/{zone_id}")
def get_zone_diagnostics(zone_id: str):
    state = load_current_state()
    zone = state.get(zone_id)

    if not zone:
        # Fallback search by matching lower-case name or ID
        for k, v in state.items():
            if k.lower() == zone_id.lower() or v.get("name", "").lower() == zone_id.lower():
                zone = v
                zone_id = k
                break

    if not zone:
        return {
            "id": zone_id,
            "name": zone_id.replace("_", " ").title(),
            "type": "standard",
            "aspect": "occupancy",
            "diagnostic": "All parameters within baseline.",
            "metricLabel": "Status Normal",
            "choices": []
        }

    status = zone.get("status", "normal")
    aspect = zone.get("aspect", "occupancy")

    # Custom strategy choices when in anomaly states
    choices = []
    if zone_id == "pipe_junction_bwssb_1" and status == "critical":
        choices = [{
            "id": "strategy-1",
            "title": "Emergency Valve Shutoff",
            "desc": "Isolates junction BWSSB-1 remotely.",
            "delta": "-100% Flow",
            "projectedData": [45, 10, 0, 0, 0]
        }]
    elif zone_id == "main_server_room" and status == "critical":
        choices = [{
            "id": "strategy-2",
            "title": "Reroute Secondary Chiller",
            "desc": "Engages auxiliary cooling loop.",
            "delta": "-12.5 C Temp",
            "projectedData": [38.5, 34.0, 28.0, 23.5, 21.0]
        }]

    return {
        "id": zone_id,
        "name": zone.get("name"),
        "type": "standard",
        "aspect": aspect,
        "diagnostic": f"Anomaly active: {status}" if status != "normal" else "All environmental parameters operating within normal baselines.",
        "metricLabel": "Telemetry Metric",
        "choices": choices
    }


# Action Execution Trigger
@app.post("/api/v1/actions/execute")
def execute_action(payload: dict):
    zone_id = payload.get("zoneId")
    choice_id = payload.get("choiceId")

    # Trigger reset to LIVE/OFF mode
    for file_path in [DEMO_MODE_FILE, SCENARIO_TRIGGER_FILE]:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("OFF")
        except Exception:
            pass

    return {
        "status": "success",
        "message": f"Strategy {choice_id} executed successfully for {zone_id}.",
        "updatedZoneState": "normal"
    }


# Legacy trigger endpoint
@app.post("/api/trigger_demo")
def trigger_demo(scenario: str):
    target_mode = "LIVE" if scenario.lower() in ["off", "live", "reset"] else scenario
    for file_path in [DEMO_MODE_FILE, SCENARIO_TRIGGER_FILE]:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(target_mode)
        except Exception:
            pass
    return {"status": "success", "scenario": target_mode}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)