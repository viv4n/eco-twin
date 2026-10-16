import os
import re
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import state
from demo_payloads import DEMO_PAYLOADS

# Load environment variables strictly from .env
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("eco_twin.router")

app = FastAPI(
    title="EcoTwin Central Router (Module 2)",
    description="Central brain for Sustainable Campus Digital Twin",
    version="1.0.0"
)

# CORS enabled for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory strategy cache
STRATEGY_CACHE: Dict[str, Any] = {}

# -------------------------------------------------------------------
# Pydantic v2 Models for generate_strategy
# -------------------------------------------------------------------

class ChoiceCard(BaseModel):
    id: str = Field(..., description="Option identifier, e.g., '1', '2', '3'")
    title: str = Field(..., description="Short title of strategy")
    description: str = Field(..., description="Actionable summary")
    chart_data: List[int] = Field(..., min_length=5, max_length=5, description="5 projected hourly kW values")

    @field_validator("chart_data")
    @classmethod
    def validate_chart_data(cls, v: List[int]) -> List[int]:
        if len(v) != 5:
            raise ValueError(f"chart_data must have exactly 5 integers, got {len(v)}")
        return [int(x) for x in v]

class StrategyResponse(BaseModel):
    diagnostic: str = Field(..., description="Plain English summary")
    choices: List[ChoiceCard] = Field(..., min_length=3, max_length=3, description="Exactly 3 choices")

    @field_validator("choices")
    @classmethod
    def validate_choices(cls, v: List[ChoiceCard]) -> List[ChoiceCard]:
        if len(v) != 3:
            raise ValueError(f"choices must contain exactly 3 choices, got {len(v)}")
        return v

class StrategyRequest(BaseModel):
    zone_id: str

def normalize_zone_id(zone_id: str) -> str:
    """Normalize zone identifiers so requests like 'Science Block' or 'science-block' resolve consistently."""
    if zone_id is None:
        return ""
    normalized = str(zone_id).strip().lower().replace("-", "_")
    normalized = re.sub(r"\s+", "_", normalized)
    normalized = re.sub(r"[^a-z0-9_]", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized


# -------------------------------------------------------------------
# Fallback Strategies matching exact schema
# -------------------------------------------------------------------

FALLBACK_STRATEGIES: Dict[str, Dict[str, Any]] = {
    "lecture_hall_a": {
        "diagnostic": "HVAC systems running at full capacity (75 kW) while occupancy dropped to zero. Sustained cooling of empty space is consuming excess electrical load.",
        "choices": [
            {
                "id": "1",
                "title": "Aggressive HVAC Shutdown (-38% Energy)",
                "description": "Immediately powers down AHU-02 & AHU-03 in unoccupied zones.",
                "chart_data": [45, 42, 38, 35, 30]
            },
            {
                "id": "2",
                "title": "Moderate Thermal Setback (-18% Energy)",
                "description": "Adjusts setpoint by +2.5°C across non-critical lab rooms.",
                "chart_data": [62, 58, 55, 52, 48]
            },
            {
                "id": "3",
                "title": "Baseline Maintenance (0% Delta)",
                "description": "Maintains active schedule; logs warning to facility portal.",
                "chart_data": [75, 75, 70, 60, 55]
            }
        ]
    },
    "science_block": {
        "diagnostic": "Flow sensor detects water loss anomaly of 50 gal/hr in Science Block. High probability of pipe rupture.",
        "choices": [
            {
                "id": "1",
                "title": "Automated Main Solenoid Isolation",
                "description": "Trigger motorized shutoff valve on Science Block primary feed line immediately.",
                "chart_data": [10, 5, 2, 0, 0]
            },
            {
                "id": "2",
                "title": "Zonal Lab Wing Isolation",
                "description": "Isolate sub-manifold for Lab Wing B while preserving emergency eyewash and safety reserves.",
                "chart_data": [25, 20, 18, 15, 12]
            },
            {
                "id": "3",
                "title": "Baseline Field Dispatch",
                "description": "Retain flow while facilities team conducts on-site valve assessment.",
                "chart_data": [50, 50, 48, 45, 40]
            }
        ]
    },
    "cafeteria": {
        "diagnostic": "Smart compactor bin capacity exceeded at 115%. High risk of refuse overflow during lunch peak.",
        "choices": [
            {
                "id": "1",
                "title": "Priority Compactor Dispatch",
                "description": "Deploy autonomous custodial unit and lock intake hopper to prevent overflow.",
                "chart_data": [20, 15, 10, 10, 10]
            },
            {
                "id": "2",
                "title": "Load Balance to Secondary Stations",
                "description": "Redirect foot traffic via digital signage to auxiliary recycling bins in east corridor.",
                "chart_data": [50, 40, 35, 30, 25]
            },
            {
                "id": "3",
                "title": "Standard Schedule Route",
                "description": "Maintain existing schedule until 18:00 evening custodial route.",
                "chart_data": [115, 120, 125, 120, 110]
            }
        ]
    },
    "main_lot": {
        "diagnostic": "Main Parking Lot capacity has reached 100%. Inbound vehicle queues are creating gridlock along North Access Road.",
        "choices": [
            {
                "id": "1",
                "title": "Dynamic Reroute to North Garage (-60% Congestion)",
                "description": "Activate dynamic road signage to redirect incoming commuter traffic to North Garage.",
                "chart_data": [85, 70, 55, 45, 40]
            },
            {
                "id": "2",
                "title": "Shuttle Frequency Ramp (-30% Congestion)",
                "description": "Dispatch express shuttle to perimeter lot and throttle Main Lot gate entry.",
                "chart_data": [92, 80, 72, 65, 58]
            },
            {
                "id": "3",
                "title": "Baseline Monitoring (0% Delta)",
                "description": "Retain current gate allocation; broadcast full capacity alert on mobile campus app.",
                "chart_data": [100, 100, 95, 88, 80]
            }
        ]
    },
}

def get_hardcoded_fallback(zone_id: str) -> StrategyResponse:
    """Returns a hardcoded fallback matching the StrategyResponse schema."""
    cleaned_id = normalize_zone_id(zone_id)
    data = FALLBACK_STRATEGIES.get(cleaned_id)
    if not data:
        data = {
            "diagnostic": f"Telemetry alert registered in {zone_id.replace('_', ' ').title()}.",
            "choices": [
                {
                    "id": "1",
                    "title": "Aggressive Automated Intervention (-35% Load)",
                    "description": f"Automated power shedding and sub-system throttling in {zone_id}.",
                    "chart_data": [40, 35, 30, 25, 20]
                },
                {
                    "id": "2",
                    "title": "Moderate Setpoint Adjustment (-15% Load)",
                    "description": f"Gradual operational setpoint ramp-down in {zone_id}.",
                    "chart_data": [60, 55, 50, 48, 45]
                },
                {
                    "id": "3",
                    "title": "Baseline Operational Monitoring",
                    "description": "Maintain active schedule and log incident to system ledger.",
                    "chart_data": [75, 75, 70, 65, 60]
                }
            ]
        }
    return StrategyResponse.model_validate(data)

# -------------------------------------------------------------------
# Twilio Critical Alert Interceptor
# -------------------------------------------------------------------

def send_twilio_critical_alert(zone_id: str, issue: str) -> Dict[str, Any]:
    """
    Sends Twilio SMS for critical priority events.
    If Twilio keys are missing or dispatch fails, skips it instead of crashing.
    """
    sid = os.getenv("TWILIO_ACCOUNT_SID") or os.getenv("TWILIO_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN") or os.getenv("TWILIO_TOKEN")
    from_num = os.getenv("TWILIO_PHONE_NUMBER") or os.getenv("TWILIO_PHONE")
    to_num = os.getenv("PRESENTER_CELL") or os.getenv("TWILIO_TO_NUMBER")

    if not (sid and token and from_num and to_num):
        logger.info("Twilio keys missing or incomplete; skipping SMS dispatch.")
        return {"status": "skipped", "reason": "missing_keys"}

    try:
        from twilio.rest import Client
        client = Client(sid, token)
        message = client.messages.create(
            body=f"CRITICAL ALERT: Pipe burst in {zone_id}. Dispatching crew.",
            from_=from_num,
            to=to_num
        )
        logger.info(f"Twilio SMS sent successfully! SID: {message.sid}")
        return {"status": "sent", "sid": message.sid}
    except Exception as e:
        logger.warning(f"Twilio SMS sending failed: {e}. Skipping instead of crashing.")
        return {"status": "skipped", "error": str(e)}

# -------------------------------------------------------------------
# Strategy Generation via OpenAI / Groq SDK with 8s Timeout & Fallback
# -------------------------------------------------------------------

def generate_strategy_with_llm(zone_id: str) -> StrategyResponse:
    """
    Calls OpenAI-compatible client (Groq if GROQ_API_KEY is set, else OpenAI)
    with response_format json_object, 8s timeout, Pydantic v2 validation.
    Returns hardcoded fallback on ANY failure.
    """
    normalized_zone_id = normalize_zone_id(zone_id)

    try:
        groq_key = os.getenv("GROQ_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")

        client = None
        model = None

        if groq_key:
            from openai import OpenAI
            client = OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=groq_key,
                timeout=8.0
            )
            model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        elif openai_key:
            from openai import OpenAI
            client = OpenAI(
                api_key=openai_key,
                timeout=8.0
            )
            model = os.getenv("OPENAI_MODEL", "gpt-4o")

        if not client or not model:
            logger.info("No LLM API keys provided; using hardcoded fallback.")
            return get_hardcoded_fallback(zone_id)

        system_prompt = (
            "You are an enterprise Digital Twin control system.\n"
            "Input: Sensor data from a campus zone.\n"
            "Task: Generate exactly three intervention strategies (Aggressive, Moderate, Baseline).\n"
            "Constraint 1: Output ONLY valid JSON matching the schema.\n"
            "Constraint 2: Do NOT include markdown formatting (```json) or conversational text.\n"
            "Constraint 3: 'chart_data' must be an array of exactly 5 integers representing projected energy usage (kW) over the next 5 hours.\n\n"
            "Schema:\n"
            "{\n"
            '  "diagnostic": "Plain English summary",\n'
            '  "choices": [\n'
            '    {"id": "1", "title": "...", "description": "...", "chart_data": [1, 2, 3, 4, 5]},\n'
            '    {"id": "2", "title": "...", "description": "...", "chart_data": [1, 2, 3, 4, 5]},\n'
            '    {"id": "3", "title": "...", "description": "...", "chart_data": [1, 2, 3, 4, 5]}\n'
            "  ]\n"
            "}"
        )

        current_state = state.read_state()
        zone_data = current_state.get(normalized_zone_id, {})

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Zone: {normalized_zone_id}. Current sensor data: {json.dumps(zone_data)}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            timeout=8.0
        )

        raw_json = response.choices[0].message.content
        parsed = json.loads(raw_json)
        return StrategyResponse.model_validate(parsed)

    except Exception as e:
        logger.warning(f"LLM failed: {e}; returning hardcoded fallback.")
        return get_hardcoded_fallback(zone_id)

# -------------------------------------------------------------------
# Required Endpoints
# -------------------------------------------------------------------

@app.get("/api/state")
def get_campus_state() -> Dict[str, Any]:
    """Single source of truth polled by React frontend."""
    return state.read_state()

@app.post("/api/trigger/{scenario_id}")
def post_trigger_scenario(scenario_id: str) -> Dict[str, Any]:
    """
    Trigger demo scenario.
    Sets _meta.demo_mode to True, updates state.json atomically.
    Critical-priority events (water_leak) skip the LLM and send Twilio SMS.
    """
    if scenario_id not in DEMO_PAYLOADS:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    updated_state = state.trigger_demo(scenario_id)

    # Critical-priority event interceptor: water_leak skips LLM and sends Twilio SMS
    sms_result = None
    if scenario_id == "water_leak":
        sms_result = send_twilio_critical_alert("Science Block", "water_leak")

    return {
        "status": "success",
        "scenario_id": scenario_id,
        "sms_dispatch": sms_result,
        **updated_state
    }

@app.post("/api/reset")
def post_reset_state() -> Dict[str, Any]:
    """
    Resets state to baseline.
    Sets _meta.demo_mode back to False.
    Clears the strategy cache.
    """
    STRATEGY_CACHE.clear()
    logger.info("Strategy cache cleared.")
    reset_data = state.reset_state()
    return {
        "status": "success",
        **reset_data
    }

@app.post("/api/generate_strategy", response_model=StrategyResponse)
def post_generate_strategy(req: StrategyRequest) -> StrategyResponse:
    """
    Generates strategic options for given zone_id.
    Caches results and validates strictly with Pydantic v2 (3 choices, 5 ints per chart_data).
    Uses 8s timeout with hardcoded fallback.
    """
    normalized_zone_id = normalize_zone_id(req.zone_id)

    if normalized_zone_id in STRATEGY_CACHE:
        logger.info(f"Returning cached strategy for zone: {normalized_zone_id}")
        return STRATEGY_CACHE[normalized_zone_id]

    strategy = generate_strategy_with_llm(normalized_zone_id)
    STRATEGY_CACHE[normalized_zone_id] = strategy
    return strategy

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

from realtime import router as ws_router  # noqa: E402
app.include_router(ws_router)
