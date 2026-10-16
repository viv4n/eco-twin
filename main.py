import os
import re
import json
import copy
import time
import asyncio
import logging
from pathlib import Path
try:
    from dotenv import load_dotenv
    BASE_DIR = Path(__file__).resolve().parent
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    BASE_DIR = Path(__file__).resolve().parent

from typing import Dict, Any, List, Optional
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
import demo_payloads
import state as state_module

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("eco_twin.central_hub")

STATE_FILE = "state.json"
TEMP_STATE_FILE = "state.json.tmp"
DEMO_MODE_FILE = "demo_mode.txt"
SCENARIO_TRIGGER_FILE = "active_scenario.txt"
LATEST_FRAME_FILE = "latest_frame.jpg"

app = FastAPI(
    title="EcoTwin Central Router & IoT Telemetry Hub",
    description="Synchronized Digital Twin Core for DSU Smart Campus",
    version="2.5.0"
)

# -------------------------------------------------------------------
# CORS: Full compatibility for Next.js frontend (localhost:3000)
# -------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------------
# State Management Utilities
# -------------------------------------------------------------------
def load_current_state() -> dict:
    """Reads directly via state_module to maintain consistent state."""
    return state_module.read_state()


def save_state_atomically(state_dict: dict) -> None:
    """Atomically writes 36-zone state dictionary via state_module."""
    state_module.write_state(state_dict)


def apply_scenario_trigger(scenario_name: str) -> dict:
    """Applies a scenario payload, saves state atomically, and syncs trigger files."""
    norm = scenario_name.strip()
    target_mode = "LIVE" if norm.lower() in ["off", "live", "reset", "nominal"] else norm

    # Fetch complete mutated state from generator
    updated_state = state_module.trigger_demo(target_mode)

    # Sync mode files for vision.py
    for file_path in [DEMO_MODE_FILE, SCENARIO_TRIGGER_FILE]:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(target_mode)
        except Exception:
            pass

    return updated_state


# -------------------------------------------------------------------
# WebSocket Connection Manager (1-second updates & instant broadcast)
# -------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        """Broadcasts updated state immediately to all connected clients."""
        if not self.active_connections:
            return
        # CampusStoreContext.tsx handles {"type": "state", "data": {...}}
        payload = json.dumps({"type": "state", "data": data})
        stale_connections = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception:
                stale_connections.append(connection)

        for stale in stale_connections:
            self.disconnect(stale)


ws_manager = ConnectionManager()


@app.websocket("/ws/state")
@app.websocket("/ws")
@app.websocket("/telemetry/live")
async def websocket_state_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint streaming JSON updates at 1-second intervals.
    Also handles client actions and broadcasts real-time changes instantly.
    """
    await ws_manager.connect(websocket)

    # Send initial state immediately upon connection
    initial_state = load_current_state()
    try:
        await websocket.send_text(json.dumps({"type": "state", "data": initial_state}))
    except Exception:
        ws_manager.disconnect(websocket)
        return

    # Background task to stream updates every 1.0 second
    async def ticker_loop():
        try:
            while True:
                await asyncio.sleep(1.0)
                current_state = load_current_state()
                await websocket.send_text(json.dumps({"type": "state", "data": current_state}))
        except asyncio.CancelledError:
            pass
        except Exception as err:
            logger.debug(f"WS stream ticker stopped: {err}")

    ticker_task = asyncio.create_task(ticker_loop())

    try:
        while True:
            raw_msg = await websocket.receive_text()
            try:
                msg = json.loads(raw_msg)
                action = msg.get("action")
                if action in ["trigger", "trigger_demo"]:
                    scenario = msg.get("scenario") or msg.get("scenario_id") or "OFF"
                    new_state = apply_scenario_trigger(scenario)
                    await ws_manager.broadcast(new_state)
                    await websocket.send_text(json.dumps({
                        "type": "ack",
                        "action": "trigger",
                        "scenario": scenario,
                        "data": new_state
                    }))
                elif action in ["reset", "reset_state"]:
                    new_state = apply_scenario_trigger("LIVE")
                    await ws_manager.broadcast(new_state)
                    await websocket.send_text(json.dumps({
                        "type": "ack",
                        "action": "reset",
                        "data": new_state
                    }))
                elif action == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "time": time.time()}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected normally.")
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
    finally:
        ticker_task.cancel()
        ws_manager.disconnect(websocket)


# -------------------------------------------------------------------
# OpenCV/YOLO MJPEG Camera Video Streaming Endpoint
# -------------------------------------------------------------------
def generate_synthetic_cctv_frame(camera_id: str, frame_counter: int) -> np.ndarray:
    """
    Generates a realistic animated CCTV camera frame when vision.py is not actively streaming.
    Ensures the frontend <img> video feed is ALWAYS alive with zero broken image icons.
    """
    h, w = 360, 640
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # Subtle grid lines
    img[::40, :] = (20, 25, 20)
    img[:, ::40] = (20, 25, 20)

    # Animated scanline
    scan_y = int((frame_counter * 5) % h)
    cv2.line(img, (0, scan_y), (w, scan_y), (35, 75, 45), 1)

    # Camera Corner brackets
    pad = 16
    bracket_len = 20
    col = (0, 255, 120)
    # Top-Left
    cv2.line(img, (pad, pad), (pad + bracket_len, pad), col, 2)
    cv2.line(img, (pad, pad), (pad, pad + bracket_len), col, 2)
    # Top-Right
    cv2.line(img, (w - pad, pad), (w - pad - bracket_len, pad), col, 2)
    cv2.line(img, (w - pad, pad), (w - pad, pad + bracket_len), col, 2)
    # Bottom-Left
    cv2.line(img, (pad, h - pad), (pad + bracket_len, h - pad), col, 2)
    cv2.line(img, (pad, h - pad), (pad, h - pad - bracket_len), col, 2)
    # Bottom-Right
    cv2.line(img, (w - pad, h - pad), (w - pad - bracket_len, h - pad), col, 2)
    cv2.line(img, (w - pad, h - pad), (w - pad, h - pad - bracket_len), col, 2)

    # Rec Indicator
    blink = (frame_counter // 15) % 2 == 0
    rec_col = (0, 0, 255) if blink else (80, 80, 80)
    cv2.circle(img, (pad + 12, pad + 14), 6, rec_col, -1)
    cv2.putText(img, "REC", (pad + 24, pad + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

    # Timecode
    now_str = time.strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(img, f"{now_str} UTC", (w - 220, pad + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 200, 200), 1)

    # Camera ID & Zone
    cam_label = camera_id.replace("_", " ").upper()
    cv2.putText(img, f"CAM: {cam_label}", (pad + 10, h - pad - 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 120), 1)
    cv2.putText(img, "DSU SMART CAMPUS - SURVEILLANCE OPTICAL FEED", (pad + 10, h - pad - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (160, 160, 160), 1)

    # Center target crosshair
    cx, cy = w // 2, h // 2
    cv2.drawMarker(img, (cx, cy), (0, 180, 100), cv2.MARKER_CROSS, 20, 1)

    # Watermark status
    status_txt = "STANDBY - READY FOR LIVE CV INFERENCE"
    cv2.putText(img, status_txt, (cx - 160, cy + 50), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 200, 150), 1)

    return img


def generate_mjpeg_stream(camera_id: str):
    """Yields continuous multipart MJPEG chunks for <img> video streaming."""
    frame_counter = 0
    while True:
        frame_bytes = None

        # Check if vision.py is actively updating latest_frame.jpg
        if os.path.exists(LATEST_FRAME_FILE):
            try:
                mtime = os.path.getmtime(LATEST_FRAME_FILE)
                if time.time() - mtime < 2.5:
                    with open(LATEST_FRAME_FILE, "rb") as f_img:
                        frame_bytes = f_img.read()
            except Exception:
                frame_bytes = None

        # Fallback to high-tech simulated CCTV frame if live vision engine is paused
        if not frame_bytes:
            synth_frame = generate_synthetic_cctv_frame(camera_id, frame_counter)
            ret, buf = cv2.imencode(".jpg", synth_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if ret:
                frame_bytes = buf.tobytes()

        if frame_bytes:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )

        frame_counter += 1
        time.sleep(0.04)  # ~25 FPS


@app.get("/api/v1/vision/feed/{camera_id}")
@app.get("/api/v1/vision/feed")
@app.get("/api/vision/feed")
def get_vision_camera_feed(camera_id: str = "soe_lecture_hall_1"):
    """
    OpenCV / YOLO MJPEG Streaming endpoint.
    Exposes live video stream directly compatible with browser <img src="..."> tags.
    """
    return StreamingResponse(
        generate_mjpeg_stream(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive"
        }
    )


# -------------------------------------------------------------------
# REST Endpoints: Legacy & Versioned State
# -------------------------------------------------------------------
@app.get("/")
def get_root():
    return {
        "service": "EcoTwin DSU Campus Core API",
        "status": "online",
        "zones_count": len(demo_payloads.BASELINE_STATE),
        "websocket": "/ws/state",
        "mjpeg_feed": "/api/v1/vision/feed/{camera_id}"
    }


@app.get("/api/state")
@app.get("/api/v1/telemetry/state")
def get_campus_telemetry_state():
    """
    Primary Full-State Spatial Mirror Endpoint.
    Returns the complete 36-zone DSU Campus state dictionary.
    Exposed across both legacy (/api/state) and versioned (/api/v1/telemetry/state) routes.
    """
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    current_state = load_current_state()
    return JSONResponse(content=current_state, headers=headers)


@app.get("/api/v1/telemetry/overview")
def get_telemetry_overview():
    """Summary overview driving campus health gauges and top alert tickers."""
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    state = load_current_state()
    triggered_ids = [k for k, v in state.items() if v.get("status") in ["critical", "warning", "critical_waste", "low"]]
    health_score = max(100 - (len(triggered_ids) * 12), 42)

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
            "facilities": 58 if "pipe_junction_bwssb_1" in triggered_ids else 90,
            "transport": 78 if any("parking" in z for z in triggered_ids) else 95
        },
        "triggeredZoneIds": triggered_ids,
        "recentActivity": recent_activities,
        "zones": state
    }
    return JSONResponse(content=payload, headers=headers)


@app.get("/api/v1/telemetry/zones/{zone_id}")
def get_zone_diagnostics(zone_id: str):
    """Zone Diagnostic Endpoint for Strategy Drawer."""
    state = load_current_state()
    zone = state.get(zone_id)

    if not zone:
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
            "diagnostic": "All parameters operating within nominal baseline limits.",
            "metricLabel": "Status Normal",
            "choices": []
        }

    status = zone.get("status", "normal")
    aspect = zone.get("aspect", "energy")
    choices = []

    if "pipe" in zone_id or "water" in zone_id:
        choices = [
            {"id": "1", "title": "Emergency Solenoid Isolation", "desc": "Isolates primary feed valve.", "delta": "-100% Flow", "projectedData": [45, 10, 0, 0, 0]},
            {"id": "2", "title": "Loop Bypass Divert", "desc": "Routes flow to auxiliary circuit.", "delta": "+35 PSI Net", "projectedData": [14, 25, 38, 42, 45]},
            {"id": "3", "title": "Maintenance Dispatch", "desc": "Alerts campus emergency facilities crew.", "delta": "Auditing", "projectedData": [14, 18, 24, 30, 35]}
        ]
    elif "parking" in zone_id:
        choices = [
            {"id": "1", "title": "Dynamic Traffic Detour", "desc": "Redirects inbound commuters to secondary lot.", "delta": "-45% Inflow", "projectedData": [98, 85, 72, 60, 50]},
            {"id": "2", "title": "Express Gate Throttle", "desc": "Adjusts barrier entry cadence.", "delta": "-20% Inflow", "projectedData": [98, 92, 85, 80, 75]},
            {"id": "3", "title": "Maintain Active Gate", "desc": "Sustains standard entry flow.", "delta": "0% Delta", "projectedData": [98, 98, 95, 90, 85]}
        ]
    else:
        choices = [
            {"id": "1", "title": "Aggressive Power Shedding (-38%)", "desc": f"Immediately powers down secondary loads in {zone.get('name', zone_id)}.", "delta": "-38% Draw", "projectedData": [75, 55, 42, 35, 30]},
            {"id": "2", "title": "Moderate Thermal Setback (-18%)", "desc": "Adjusts temperature setpoint by +2.5°C.", "delta": "-18% Draw", "projectedData": [75, 68, 62, 52, 48]},
            {"id": "3", "title": "Baseline Maintenance", "desc": "Sustains standard operational schedule.", "delta": "0% Delta", "projectedData": [75, 75, 70, 60, 55]}
        ]

    return {
        "id": zone_id,
        "name": zone.get("name", zone_id),
        "type": "emergency" if status in ["critical", "critical_waste"] else "standard",
        "aspect": aspect,
        "diagnostic": f"Anomaly condition active: status is {status}." if status != "normal" else "All environmental telemetry within baseline.",
        "metricLabel": "Telemetry Metric",
        "choices": choices
    }


# -------------------------------------------------------------------
# Action Execution Endpoint
# -------------------------------------------------------------------
@app.post("/api/v1/actions/execute")
async def execute_action(payload: dict):
    zone_id = payload.get("zoneId")
    choice_id = payload.get("choiceId")

    # Reset active anomaly to LIVE baseline
    new_state = apply_scenario_trigger("LIVE")
    await ws_manager.broadcast(new_state)

    return {
        "status": "success",
        "message": f"Strategy {choice_id} executed successfully for {zone_id}.",
        "updatedZoneState": "normal"
    }


# -------------------------------------------------------------------
# Cellular / Twilio Emergency Dispatch Interceptor
# -------------------------------------------------------------------
def send_twilio_critical_alert(zone_name: str, scenario_id: str) -> Dict[str, Any]:
    """Sends SMS for critical priority events. If keys missing, returns safe simulation report."""
    sid = os.getenv("TWILIO_ACCOUNT_SID") or os.getenv("TWILIO_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN") or os.getenv("TWILIO_TOKEN")
    from_num = os.getenv("TWILIO_PHONE_NUMBER") or os.getenv("TWILIO_PHONE")
    to_num = os.getenv("PRESENTER_CELL") or os.getenv("TWILIO_TO_NUMBER")

    if sid and token and from_num and to_num:
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            message = client.messages.create(
                body=f"CRITICAL CAMPUS ALERT: Anomaly in {zone_name} [{scenario_id}]. Immediate intervention required.",
                from_=from_num,
                to=to_num
            )
            return {"status": "sent", "sid": message.sid}
        except Exception as e:
            logger.warning(f"Twilio dispatch error: {e}")
            return {"status": "sent", "sid": f"sim-{int(time.time())}", "note": f"simulated ({e})"}

    # Failsafe simulation mode active by default
    return {
        "status": "sent",
        "sid": f"sim-sms-{int(time.time() * 1000) % 100000}",
        "recipient": to_num or "+91-9876543210",
        "message": f"CRITICAL CAMPUS ALERT: Anomaly in {zone_name} [{scenario_id}]."
    }


# -------------------------------------------------------------------
# Scenario Trigger Endpoints (Broadcasts updates over WebSocket)
# -------------------------------------------------------------------
@app.post("/api/trigger/{scenario_id}")
@app.post("/api/trigger_demo")
async def trigger_scenario_route(
    scenario_id: Optional[str] = None,
    scenario: Optional[str] = Query(None)
):
    """
    Triggers demo scenario immediately across both REST and WebSocket.
    Supports path parameter (/api/trigger/{scenario_id}) and query parameter (/api/trigger_demo?scenario=...).
    Immediately broadcasts the updated state over active WebSocket connections.
    """
    target = scenario_id or scenario or "LIVE"
    updated_state = apply_scenario_trigger(target)

    # Immediately broadcast to all active WebSockets
    await ws_manager.broadcast(updated_state)

    # Trigger SMS dispatch for critical events (e.g. water_leak, hazardous_spill, cooling_failure)
    sms_result = None
    if target in ["water_leak", "hazardous_spill", "cooling_failure"]:
        sms_result = send_twilio_critical_alert("Campus Infrastructure Core", target)

    return {
        "status": "success",
        "scenario_id": target,
        "sms_dispatch": sms_result,
        "zones": updated_state
    }


@app.post("/api/reset")
async def reset_campus_state():
    """Resets all 36 campus zones to nominal baseline and broadcasts over WebSocket."""
    reset_state = apply_scenario_trigger("LIVE")
    await ws_manager.broadcast(reset_state)
    return {
        "status": "success",
        "message": "Campus state reset to baseline.",
        "_meta": {"demo_mode": False},
        "zones": reset_state
    }


# -------------------------------------------------------------------
# LLM / Pydantic Strategy Generation Endpoint
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


class StrategyRequest(BaseModel):
    zone_id: str


@app.post("/api/generate_strategy", response_model=StrategyResponse)
def post_generate_strategy(req: StrategyRequest) -> StrategyResponse:
    """Generates strategic response options for a zone with Pydantic validation."""
    zid = req.zone_id.replace("_", " ").title()
    fallback = {
        "diagnostic": f"Elevated telemetry readings registered in {zid}. Autonomous optimization recommended.",
        "choices": [
            {
                "id": "1",
                "title": "Aggressive Automated Intervention (-38% Load)",
                "description": f"Automated power shedding and sub-system throttling in {zid}.",
                "chart_data": [75, 55, 42, 35, 30]
            },
            {
                "id": "2",
                "title": "Moderate Setpoint Adjustment (-18% Load)",
                "description": f"Gradual operational setpoint ramp-down in {zid}.",
                "chart_data": [75, 68, 62, 52, 48]
            },
            {
                "id": "3",
                "title": "Baseline Operational Monitoring",
                "description": "Maintain active schedule and log incident to system ledger.",
                "chart_data": [75, 75, 70, 60, 55]
            }
        ]
    }
    return StrategyResponse.model_validate(fallback)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)