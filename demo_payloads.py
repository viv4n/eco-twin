import copy
import random
import time
import math

# Exact 36-zone DSU Campus Baseline State
BASELINE_STATE = {
    "cdsimer_hospital": { "name": "CDSIMER Hospital", "category": "utility", "status": "normal", "system_state": "normal", "automated_sms_dispatched": False },
    "main_server_room": { "name": "Main Server Room", "category": "utility", "status": "normal", "system_state": "normal_cooling", "temperature_c": 21.0, "automated_sms_dispatched": False },
    "cricket_stadium": { "name": "Cricket Stadium", "category": "sports", "status": "normal", "floodlights_state": "offline", "power_consumption_kw": 0.0 },
    "football_stadium": { "name": "Varsity Football Stadium", "category": "sports", "status": "normal", "floodlights_state": "active", "power_consumption_kw": 150.0 },
    "pipe_junction_bwssb_1": { "name": "BWSSB Pipeline Track Node 1", "category": "pipe_sensor", "status": "normal", "water_pressure_psi": 22.0, "leak_detected": False },
    "soe_center_of_engineering": { "name": "SOE Center of Engineering", "category": "academic", "status": "normal", "hvac_status": "active", "power_consumption_kw": 45.0, "baseline_variance_pct": "0%" },
    "a_block": { "name": "A Block", "category": "academic", "status": "normal", "power_consumption_kw": 32.1 },
    "nursing_block": { "name": "Nursing Block", "category": "academic", "status": "normal", "hvac_status": "active" },
    "health_sciences": { "name": "School of Health Sciences", "category": "academic", "status": "normal", "power_consumption_kw": 42.0 },
    "pharmacy_department": { "name": "Pharmacy Department", "category": "academic", "status": "normal", "hvac_status": "eco_mode" },
    "hostel_1": { "name": "Hostel 1", "category": "residential", "status": "normal" },
    "hostel_2": { "name": "Hostel 2", "category": "residential", "status": "normal" },
    "hostel_3": { "name": "Hostel 3", "category": "residential", "status": "normal" },
    "girls_hostel_4": { "name": "Girls Hostel 4", "category": "residential", "status": "normal" },
    "laundry_facility": { "name": "Laundry Facility", "category": "utility", "status": "normal", "water_usage_lpm": 120 },
    "hostel_mess": { "name": "Hostel Mess", "category": "utility", "status": "normal" },
    "cafe_1_tummy_trails": { "name": "Tummy Trails (Cafe 1)", "category": "cafe", "status": "normal", "occupancy": 85 },
    "cafe_2_bits_and_bites": { "name": "Bits and Bites (Cafe 2)", "category": "cafe", "status": "normal", "occupancy": 110 },
    "cafe_4_food_truck": { "name": "Food Truck (Cafe 4)", "category": "cafe", "status": "normal", "occupancy": 45 },
    "amphitheatre": { "name": "Amphitheatre", "category": "recreation", "status": "normal" },
    "dsu_arena": { "name": "DSU Arena", "category": "recreation", "status": "normal" },
    "open_auditorium": { "name": "Open Auditorium", "category": "recreation", "status": "normal" },
    "parking_1": { "name": "Parking 1", "category": "parking", "status": "normal", "occupancy_pct": "60%" },
    "parking_2": { "name": "Parking 2", "category": "parking", "status": "normal", "occupancy_pct": "45%" },
    "parking_3": { "name": "Parking 3", "category": "parking", "status": "normal", "occupancy_pct": "55%" },
    "parking_4": { "name": "Parking 4", "category": "parking", "status": "normal", "occupancy_pct": "40%" },
    "parking_5": { "name": "Parking 5", "category": "parking", "status": "normal", "occupancy_pct": "10%" },
    "soe_lecture_hall_1": { "name": "SOE Lecture Hall 1", "category": "lecture_hall", "status": "normal", "occupancy": 0 },
    "soe_lecture_hall_2": { "name": "SOE Lecture Hall 2", "category": "lecture_hall", "status": "normal", "occupancy": 45 },
    "soe_lecture_hall_3": { "name": "SOE Lecture Hall 3", "category": "lecture_hall", "status": "normal", "occupancy": 0 },
    "soe_lecture_hall_4": { "name": "SOE Lecture Hall 4", "category": "lecture_hall", "status": "normal", "temperature_c": 22.5, "hvac_status": "active" },
    "soe_lecture_hall_5": { "name": "SOE Lecture Hall 5", "category": "lecture_hall", "status": "normal", "occupancy": 120 },
    "soe_lecture_hall_6": { "name": "SOE Lecture Hall 6", "category": "lecture_hall", "status": "normal", "occupancy": 30 },
    "soe_classroom_a1": { "name": "Classroom A1", "category": "classroom", "status": "normal", "hvac_status": "eco_mode" },
    "soe_classroom_b4": { "name": "Classroom B4", "category": "classroom", "status": "normal", "co2_ppm": 450 },
    "pharmacy_classroom_1": { "name": "Pharmacy Classroom 1", "category": "classroom", "status": "normal" }
}

DSU_CAMPUS_BASELINE = BASELINE_STATE
BASELINE_NORMAL = BASELINE_STATE


def apply_ambient_telemetry_drift(state: dict, t: float = None) -> dict:
    """
    Applies gentle micro-fluctuations to baseline state (sports/utility zones, power, water)
    so sensors exhibit realistic live IoT behavior.
    """
    if t is None:
        t = time.time()

    # Varsity football stadium active floodlights power drift (+- 2.5 kW)
    if "football_stadium" in state and "power_consumption_kw" in state["football_stadium"]:
        drift = math.sin(t * 0.8) * 2.2 + random.uniform(-0.3, 0.3)
        state["football_stadium"]["power_consumption_kw"] = round(150.0 + drift, 1)

    # Laundry facility water usage LPM drift (+- 3 LPM)
    if "laundry_facility" in state and "water_usage_lpm" in state["laundry_facility"]:
        drift = int(round(math.sin(t * 0.5) * 2.5 + random.uniform(-1, 1)))
        state["laundry_facility"]["water_usage_lpm"] = 120 + drift

    # Academic buildings power baseline gentle micro-drift
    for b_key, base_kw in [("a_block", 32.1), ("health_sciences", 42.0)]:
        if b_key in state and "power_consumption_kw" in state[b_key]:
            p_drift = round(math.sin(t * 0.4 + hash(b_key) % 5) * 0.5 + random.uniform(-0.15, 0.15), 1)
            state[b_key]["power_consumption_kw"] = round(base_kw + p_drift, 1)

    return state


def get_water_leak_state(t: float = None) -> dict:
    """
    Mutates pipe_junction_bwssb_1:
    - water_pressure_psi drifts randomly between 13.5 and 14.8 psi.
    - Preserves all other 35 zones with ambient drift.
    """
    state = copy.deepcopy(BASELINE_STATE)
    apply_ambient_telemetry_drift(state, t)

    pressure_drift = round(random.uniform(13.5, 14.8), 2)
    state["pipe_junction_bwssb_1"].update({
        "status": "critical",
        "water_pressure_psi": pressure_drift,
        "leak_detected": True
    })
    return state


def get_cooling_failure_state(t: float = None) -> dict:
    """
    Mutates:
    - main_server_room: temperature_c drifts between 38.0 and 39.5 C.
    - soe_lecture_hall_4: temperature_c drifts between 28.0 and 29.5 C, hvac_status="failed".
    """
    state = copy.deepcopy(BASELINE_STATE)
    apply_ambient_telemetry_drift(state, t)

    server_temp = round(random.uniform(38.0, 39.5), 1)
    hall_temp = round(random.uniform(28.0, 29.5), 1)

    state["main_server_room"].update({
        "status": "critical",
        "system_state": "cooling_failure",
        "temperature_c": server_temp
    })
    state["soe_lecture_hall_4"].update({
        "status": "warning",
        "temperature_c": hall_temp,
        "hvac_status": "failed"
    })
    return state


def get_energy_waste_state(t: float = None) -> dict:
    """
    Mutates:
    - soe_center_of_engineering: power_consumption_kw drifts between 84.0 and 91.0 kW.
    - soe_classroom_b4: co2_ppm drifts between 1180 and 1250 ppm.
    """
    state = copy.deepcopy(BASELINE_STATE)
    apply_ambient_telemetry_drift(state, t)

    eng_power = round(random.uniform(84.0, 91.0), 1)
    classroom_co2 = int(round(random.uniform(1180, 1250)))

    state["soe_center_of_engineering"].update({
        "status": "critical",
        "hvac_status": "overconsuming",
        "power_consumption_kw": eng_power
    })
    state["soe_classroom_b4"].update({
        "status": "critical",
        "co2_ppm": classroom_co2
    })
    return state


def get_parking_congestion_state(t: float = None) -> dict:
    """
    Mutates:
    - parking_1: occupancy_pct drifts between 92% and 98%.
    - parking_3: occupancy_pct drifts between 95% and 100%, status="warning".
    - parking_5: occupancy_pct drifts between 82% and 88%.
    """
    state = copy.deepcopy(BASELINE_STATE)
    apply_ambient_telemetry_drift(state, t)

    p1_pct = f"{random.randint(92, 98)}%"
    p3_pct = f"{random.randint(95, 100)}%"
    p5_pct = f"{random.randint(82, 88)}%"

    state["parking_1"].update({
        "status": "warning",
        "occupancy_pct": p1_pct
    })
    state["parking_3"].update({
        "status": "critical",
        "occupancy_pct": p3_pct
    })
    state["parking_5"].update({
        "status": "normal",
        "occupancy_pct": p5_pct
    })
    return state


# Pre-generated payload dictionaries for quick access
WATER_LEAK = get_water_leak_state()
COOLING_FAILURE = get_cooling_failure_state()
ENERGY_WASTE = get_energy_waste_state()
PARKING_CONGESTION = get_parking_congestion_state()
PARKING_FULL = PARKING_CONGESTION


def get_scenario(scenario_name: str, t: float = None) -> dict:
    """
    Always returns a dynamic full 36-zone dictionary with live IoT micro-fluctuations.
    Supported scenarios (case-insensitive):
    - "water_leak"
    - "cooling_failure"
    - "energy_waste"
    - "parking_congestion" (or "parking_full")
    - "off" / "live" / "reset" (clean BASELINE_STATE with ambient telemetry drift)
    """
    if not scenario_name:
        state = copy.deepcopy(BASELINE_STATE)
        return apply_ambient_telemetry_drift(state, t)

    key = str(scenario_name).strip().lower()

    if key in ["water_leak", "waterleak"]:
        return get_water_leak_state(t)
    elif key in ["cooling_failure", "coolingfailure"]:
        return get_cooling_failure_state(t)
    elif key in ["energy_waste", "energywaste"]:
        return get_energy_waste_state(t)
    elif key in ["parking_congestion", "parkingcongestion", "parking_full", "parkingfull"]:
        return get_parking_congestion_state(t)
    elif key in ["off", "live", "reset", "baseline", "normal"]:
        # BASELINE_STATE is already all-normal; just apply ambient IoT drift
        state = copy.deepcopy(BASELINE_STATE)
        return apply_ambient_telemetry_drift(state, t)
    else:
        state = copy.deepcopy(BASELINE_STATE)
        return apply_ambient_telemetry_drift(state, t)