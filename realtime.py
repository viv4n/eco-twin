"""WebSocket channel for Module 2:  ws://localhost:8000/ws/state

Server -> client (push, on connect and on EVERY change to state.json,
including writes made by Module 1 / vision.py):
    {"type": "state", "data": {<full state: _meta + 4 zones>}}
    (set ENVELOPE = False to send the raw state JSON instead)

Client -> server (optional commands, JSON text):
    {"action": "trigger", "scenario_id": "water_leak"}
    {"action": "reset"}
    {"action": "generate_strategy", "zone_id": "lecture_hall_a"}

Server -> requesting client:
    {"type": "ack", "action": "trigger" | "reset", "data": {...}}
    {"type": "strategy", "zone_id": "...", "data": {diagnostic, choices}}
    {"type": "error", "message": "..."}

Commands call the existing HTTP endpoints in-process, so SMS dispatch (phone number
comes from .env, never from the client), the LLM call and the fallback behave the same.
"""
import asyncio
import json
from typing import Set

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from state import read_state

ENVELOPE = True  # True: {"type": "state", "data": ...}   False: raw state JSON

router = APIRouter()
clients: Set[WebSocket] = set()
_watcher = None


def _state_message(data: dict) -> dict:
    return {"type": "state", "data": data} if ENVELOPE else data


async def _broadcast(data: dict) -> None:
    dead = []
    for ws in list(clients):
        try:
            await ws.send_json(_state_message(data))
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.discard(ws)


async def _watch_state() -> None:
    last = None
    while True:
        current = read_state()
        if current != last:
            last = current
            await _broadcast(current)
        await asyncio.sleep(0.5)


async def _run_action(ws: WebSocket, msg: dict) -> dict:
    action = msg.get("action")
    transport = httpx.ASGITransport(app=ws.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://app", timeout=20) as c:
        if action == "trigger":
            r = await c.post(f"/api/trigger/{msg['scenario_id']}")
        elif action == "reset":
            r = await c.post("/api/reset")
        elif action == "generate_strategy":
            r = await c.post("/api/generate_strategy", json={"zone_id": msg["zone_id"]})
        else:
            return {"type": "error", "message": f"unknown action: {action}"}
    if r.status_code != 200:
        return {"type": "error", "action": action, "status": r.status_code, "detail": r.text}
    if action == "generate_strategy":
        return {"type": "strategy", "zone_id": msg["zone_id"], "data": r.json()}
    return {"type": "ack", "action": action, "data": r.json()}


@router.websocket("/ws/state")
async def ws_state(websocket: WebSocket):
    global _watcher
    await websocket.accept()
    clients.add(websocket)
    if _watcher is None or _watcher.done():
        _watcher = asyncio.create_task(_watch_state())
    try:
        await websocket.send_json(_state_message(read_state()))  # current state right away
        while True:
            text = await websocket.receive_text()
            try:
                reply = await _run_action(websocket, json.loads(text))
            except json.JSONDecodeError:
                reply = {"type": "error", "message": "invalid JSON"}
            except Exception as e:  # missing fields, etc.
                reply = {"type": "error", "message": str(e)}
            await websocket.send_json(reply)
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(websocket)