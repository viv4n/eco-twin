import os
import json
import copy
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import demo_payloads

STATE_FILE = "state.json"
TEMP_STATE_FILE = "state.json.tmp"
DEMO_MODE_FILE = "demo_mode.txt"

app = FastAPI(
    title="EcoTwin DSU Campus IoT Backend",
    description="Real-time IoT State & Scenario Trigger Engine for DSU EcoTwin Campus",
    version="1.0.0"
)

# Enable CORS for React/Leaflet frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def atomic_write_state(state_dict: dict, max_retries: int = 3):
    """
    Atomically writes 36-zone state to state.json using temporary file swap.
    """
    clean_state = {k: copy.deepcopy(state_dict[k]) for k in demo_payloads.BASELINE_STATE if k in state_dict}
    for _ in range(max_retries):
        try:
            with open(TEMP_STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(clean_state, f, indent=2)
                f.flush()
                os.fsync(f.fileno())

            try:
                os.replace(TEMP_STATE_FILE, STATE_FILE)
            except (PermissionError, OSError):
                with open(STATE_FILE, "w", encoding="utf-8") as f:
                    json.dump(clean_state, f, indent=2)
            break
        except Exception:
            pass


@app.get("/")
def root():
    return {
        "service": "EcoTwin DSU Campus API",
        "status": "online",
        "zones": len(demo_payloads.BASELINE_STATE)
    }


@app.get("/api/state")
def get_campus_state(response: Response):
    """
    Reads directly from state.json on every single request (no local variable caching).
    Sets Cache-Control headers so the React/Leaflet frontend never receives stale cached data.
    """
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }

    if not os.path.exists(STATE_FILE):
        fresh_state = copy.deepcopy(demo_payloads.BASELINE_STATE)
        atomic_write_state(fresh_state)
        return JSONResponse(content=fresh_state, headers=headers)

    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            state_data = json.load(f)
    except Exception as e:
        # Fallback to fresh baseline if file read encounters brief contention
        state_data = copy.deepcopy(demo_payloads.BASELINE_STATE)

    return JSONResponse(content=state_data, headers=headers)


@app.post("/api/trigger_demo")
def trigger_demo(scenario: str):
    """
    Updates active_mode in demo_mode.txt (synced with vision.py)
    and overwrites state.json atomically using demo_payloads.get_scenario(scenario).
    Supported scenarios: 'water_leak', 'cooling_failure', 'energy_waste', 'parking_congestion', 'OFF', 'LIVE'.
    """
    valid_scenarios = [
        "water_leak", "cooling_failure", "energy_waste",
        "parking_congestion", "off", "live", "reset"
    ]
    normalized_scenario = str(scenario).strip().lower()

    if normalized_scenario not in valid_scenarios:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scenario '{scenario}'. Valid options: {valid_scenarios}"
        )

    # 1. Update demo_mode.txt so vision.py syncs active_mode immediately
    target_mode = "LIVE" if normalized_scenario in ["off", "live", "reset"] else normalized_scenario
    try:
        with open(DEMO_MODE_FILE, "w", encoding="utf-8") as f:
            f.write(target_mode)
    except Exception as e:
        print(f"Warning: Could not write {DEMO_MODE_FILE}: {e}")

    # 2. Generate full 36-zone mutated state dictionary
    mutated_state = demo_payloads.get_scenario(target_mode)

    # 3. Atomically overwrite state.json
    atomic_write_state(mutated_state)

    return {
        "status": "success",
        "scenario": target_mode,
        "message": f"[DEMO TRIGGER] Active Mode set to '{target_mode}'",
        "zones_updated": len(mutated_state)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

