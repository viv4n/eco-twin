import json
import os
import copy
from pathlib import Path
from typing import Dict, Any

import demo_payloads

# Pure in-memory state store for 100% serverless fault-tolerance (e.g. Vercel read-only environments)
VALID_STATUSES = {"normal", "low", "warning", "critical", "critical_waste"}

_GLOBAL_STATE: Dict[str, Any] = copy.deepcopy(demo_payloads.BASELINE_STATE)
_GLOBAL_STATE["_meta"] = {"demo_mode": False}

# Fallback writable paths for local/ephemeral disk caching
FALLBACK_FILE_PATHS = [
    Path("/tmp/eco_twin_state.json"),
    Path(__file__).resolve().parent / "state.json",
]


def _coerce_status(status: Any) -> str:
    return status if isinstance(status, str) and status in VALID_STATUSES else "normal"


def _sanitize_state(data: Any) -> Dict[str, Any]:
    """Sanitize state preserving all 36 DSU building keys, legacy aliases, and valid statuses."""
    if not isinstance(data, dict):
        return copy.deepcopy(_GLOBAL_STATE)

    sanitized: Dict[str, Any] = {
        "_meta": {
            "demo_mode": bool(data.get("_meta", {}).get("demo_mode", False))
        }
    }

    # Include all keys from input and baseline
    all_keys = set(demo_payloads.BASELINE_STATE.keys()) | set(data.keys())
    for key in all_keys:
        if key == "_meta":
            continue
        zone_data = data.get(key, demo_payloads.BASELINE_STATE.get(key, {}))
        if not isinstance(zone_data, dict):
            zone_data = {}
        cleaned_zone = dict(zone_data)
        if "status" in cleaned_zone:
            cleaned_zone["status"] = _coerce_status(cleaned_zone["status"])
        sanitized[key] = cleaned_zone

    return sanitized


def read_state() -> Dict[str, Any]:
    """
    Reads state with zero disk-write dependency.
    Checks in-memory _GLOBAL_STATE first, with safe fallback to disk if available.
    """
    global _GLOBAL_STATE

    # If memory state has data, return it directly
    if isinstance(_GLOBAL_STATE, dict) and len(_GLOBAL_STATE) > 1:
        return copy.deepcopy(_GLOBAL_STATE)

    # Attempt to load from disk without crashing if read-only or missing
    for file_path in FALLBACK_FILE_PATHS:
        try:
            if file_path.exists():
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        loaded = json.loads(content)
                        if isinstance(loaded, dict) and len(loaded) > 0:
                            _GLOBAL_STATE = _sanitize_state(loaded)
                            return copy.deepcopy(_GLOBAL_STATE)
        except Exception:
            continue

    _GLOBAL_STATE = copy.deepcopy(demo_payloads.BASELINE_STATE)
    _GLOBAL_STATE["_meta"] = {"demo_mode": False}
    return copy.deepcopy(_GLOBAL_STATE)


def write_state(data: Dict[str, Any]) -> None:
    """
    Pure in-memory state persistence with safe, non-crashing ephemeral disk write attempt.
    Under Vercel read-only filesystem, never raises Errno 30.
    """
    global _GLOBAL_STATE
    try:
        sanitized = _sanitize_state(data)
        _GLOBAL_STATE = copy.deepcopy(sanitized)
    except Exception:
        pass

    # Safe optional write to /tmp or current directory
    for file_path in FALLBACK_FILE_PATHS:
        try:
            tmp_target = file_path.with_suffix(".tmp")
            with open(tmp_target, "w", encoding="utf-8") as f:
                json.dump(_GLOBAL_STATE, f, indent=2)
                f.flush()
            os.replace(tmp_target, file_path)
            break
        except Exception:
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(_GLOBAL_STATE, f, indent=2)
                break
            except Exception:
                continue


def reset_state() -> Dict[str, Any]:
    """
    Resets in-memory state to baseline and clears demo mode.
    Guaranteed never to throw on read-only file systems.
    """
    global _GLOBAL_STATE
    new_state = copy.deepcopy(demo_payloads.BASELINE_STATE)
    new_state["_meta"] = {"demo_mode": False}
    write_state(new_state)
    return copy.deepcopy(_GLOBAL_STATE)


def update_state(incoming_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merges incoming telemetry feeds into in-memory state safely.
    """
    global _GLOBAL_STATE
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
    return copy.deepcopy(_GLOBAL_STATE)


def trigger_demo(scenario_id: str) -> Dict[str, Any]:
    """
    Triggers a demo scenario using the complete DSU telemetry generator in pure memory.
    Sets _meta.demo_mode to True. Never crashes in serverless environments.
    """
    try:
        scenario_state = demo_payloads.get_scenario(scenario_id)
    except Exception:
        scenario_state = copy.deepcopy(demo_payloads.BASELINE_STATE)

    scenario_state["_meta"] = {"demo_mode": True}
    write_state(_sanitize_state(scenario_state))
    return read_state()
