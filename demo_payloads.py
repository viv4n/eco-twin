WATER_LEAK = {
    "zone": "Science Block",
    "issue": "water_leak",
    "priority": "critical",
    "metric": "Loss 50 gal/hr",
    "action_required": "automated_dispatch"
}

WASTE_OVERFLOW = {
    "zone": "Cafeteria",
    "issue": "waste_overflow",
    "priority": "low",
    "metric": "Bin capacity 115%",
    "action_required": "automated_dispatch"
}

PARKING_FULL = {
    "zone": "Main Lot",
    "issue": "parking_full",
    "priority": "warning",
    "metric": "100% capacity",
    "action_required": "gen_ai_decision"
}

ENERGY_SPIKE = {
    "zone": "Lecture Hall A",
    "issue": "energy_spike",
    "priority": "warning",
    "metric": "0 occupants, HVAC active (75 kW)",
    "action_required": "gen_ai_decision"
}

DEMO_PAYLOADS = {
    "water_leak": (
        "science_block",
        {
            "status": "critical",
            "water_flow": "leak_detected",
            "metric": "Loss 50 gal/hr"
        }
    ),
    "waste_overflow": (
        "cafeteria",
        {
            "status": "low",
            "waste_level": "115%",
            "metric": "Bin capacity 115%"
        }
    ),
    "parking_full": (
        "main_lot",
        {
            "status": "warning",
            "occupancy_rate": "100%",
            "metric": "100% capacity"
        }
    ),
    "energy_spike": (
        "lecture_hall_a",
        {
            "status": "warning",
            "occupancy": 0,
            "hvac": "active",
            "metric": "0 occupants, HVAC active (75 kW)"
        }
    ),
}
