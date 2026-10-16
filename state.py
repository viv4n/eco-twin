import json
import os
import copy
from pathlib import Path
from typing import Dict, Any

import demo_payloads

STATE_FILE = Path(__file__).resolve().parent / "state.json"
TMP_FILE = Path(__file__).resolve().parent / "state.json.tmp"
VALID_STATUSES = {"normal", "low", "warning", "critical", "critical_waste"}

BASELINE_STATE = copy.deepcopy(demo_payloads.BASELINE_STATE)
BASELINE_STATE["_meta"] = {"demo_mode": False}


def _coerce_status(status: Any) -> str:
    return status if isinstance(status, str) and status in VALID_STATUSES else "normal"


def _sanitize_state(data: Any) -> Dict[str, Any]:
    """Sanitize state preserving all 36 DSU building keys, legacy aliases, and valid statuses."""
    if not isinstance(data, dict):
        return copy.deepcopy(BASELINE_STATE)

    sanitized: Dict[str, Any] = {
        "_meta": {
            "demo_mode": bool(data.get("_meta", {}).get("demo_mode", False))
        }
    }

    # Include all keys from input and baseline
    all_keys = set(BASELINE_STATE.keys()) | set(data.keys())
    for key in all_keys:
        if key == "_meta":
            continue
        zone_data = data.get(key, BASELINE_STATE.get(key, {}))
        if not isinstance(zone_data, dict):
            zone_data = {}
        cleaned_zone = dict(zone_data)
        if "status" in cleaned_zone:
            cleaned_zone["status"] = _coerce_status(cleaned_zone["status"])
        sanitized[key] = cleaned_zone

    return sanitized


def read_state() -> Dict[str, Any]:
    """Atomically read the state from state.json."""
    if not os.path.exists(STATE_FILE):
        return reset_state()
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return reset_state()
            return _sanitize_state(json.loads(content))
    except Exception:
        return copy.deepcopy(BASELINE_STATE)


def write_state(data: Dict[str, Any]) -> None:
    """Atomic state persistence: write to state.json.tmp, then os.replace."""
    with open(TMP_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(TMP_FILE, STATE_FILE)


def reset_state() -> Dict[str, Any]:
    """
    Resets state to baseline.
    Sets _meta.demo_mode to False.
    """
    state = copy.deepcopy(BASELINE_STATE)
    state["_meta"]["demo_mode"] = False
    write_state(state)
    return state


def update_state(incoming_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merges incoming telemetry feeds into state.json atomically.
    Preserves existing zones and metadata.
    """
    current_state = read_state()
    for key, val in incoming_data.items():
        if key == "_meta":
            if isinstance(val, dict):
                current_state.setdefault("_meta", {}).update(val)
        elif isinstance(val, dict) and key in current_state and isinstance(current_state[key], dict):
            current_state[key].update(val)
        else:
            current_state[key] = val

    if "_meta" not in current_state or not isinstance(current_state["_meta"], dict):
        current_state["_meta"] = {}
    current_state["_meta"]["demo_mode"] = bool(current_state["_meta"].get("demo_mode", False))

    for zone_key, zone_data in current_state.items():
        if isinstance(zone_data, dict) and "status" in zone_data:
            zone_data["status"] = _coerce_status(zone_data["status"])

    write_state(_sanitize_state(current_state))
    return _sanitize_state(current_state)


def trigger_demo(scenario_id: str) -> Dict[str, Any]:
    """
    Triggers a demo scenario using the complete DSU telemetry generator.
    Sets _meta.demo_mode to True and saves atomically.
    """
    scenario_state = demo_payloads.get_scenario(scenario_id)
    scenario_state["_meta"] = {"demo_mode": True}
    write_state(_sanitize_state(scenario_state))
    return read_state()
