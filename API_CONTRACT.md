# Module 2 – API Contract (FastAPI Central Router)

Base URL: `http://localhost:8000` · WebSocket: `ws://localhost:8000/ws/state`
CORS allows `http://localhost:3000` and `http://127.0.0.1:3000`.

## Run it

```
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add GROQ_API_KEY (never commit .env)
uvicorn main:app --reload
```
Interactive docs: http://localhost:8000/docs

The camera script (Module 1) needs extra packages, kept out of `requirements.txt`:
`pip install opencv-python ultralytics`

## The shared contract: `state.json`

Single source of truth. Keys:

| Key | Fields |
|---|---|
| `_meta` | `demo_mode` (bool). **Not a zone: skip it when drawing the map.** |
| `lecture_hall_a` | `status`, `occupancy`, `hvac` |
| `science_block` | `status`, `water_flow` |
| `cafeteria` | `status`, `waste_level` |
| `main_lot` | `status`, `occupancy_rate` |

`status` is always one of: `normal`, `low`, `warning`, `critical`.
No other zones or statuses exist.

## Channel 1: WebSocket (primary for the frontend)

Connect to `ws://localhost:8000/ws/state`.

**Server pushes** the full state on connect and again on **every change** to `state.json`
(including writes by the camera script, triggers and resets):
```json
{"type": "state", "data": {"_meta": {"demo_mode": false}, "lecture_hall_a": {"status": "normal", "occupancy": 30, "hvac": "active"}, "...": "..."}}
```

**Client may send commands** (JSON text):
```json
{"action": "trigger", "scenario_id": "water_leak"}
{"action": "reset"}
{"action": "generate_strategy", "zone_id": "lecture_hall_a"}
```

**Server replies to the sender:**
```json
{"type": "ack", "action": "trigger", "data": {"...": "..."}}
{"type": "ack", "action": "reset", "data": {"...": "..."}}
{"type": "strategy", "zone_id": "lecture_hall_a", "data": {"diagnostic": "...", "choices": ["..."]}}
{"type": "error", "message": "..."}
```

Notes:
- The client **never sends a phone number**. SMS recipients come from `.env` on the server.
- To receive raw state JSON instead of the `{"type","data"}` wrapper, set `ENVELOPE = False` in `realtime.py`.
- Reconnect on close: the first message after reconnecting is the current state.

## Channel 2: HTTP (kept for tools, tests, and as a fallback)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | Full state (same JSON as the WebSocket `data`) |
| POST | `/api/trigger/{scenario_id}` | Demo ON: load a scenario, sets `_meta.demo_mode = true` |
| POST | `/api/reset` | Demo OFF: exact baseline, `demo_mode = false`, clears strategy cache |
| POST | `/api/generate_strategy` | AI strategies for a zone (body below) |

The WebSocket commands above call these same endpoints, so behaviour is identical.

### Scenarios (`scenario_id`)

| id | Zone | Status | Notes |
|---|---|---|---|
| `water_leak` | `science_block` | `critical` | Skips the LLM, sends Twilio SMS (skipped if keys missing) |
| `waste_overflow` | `cafeteria` | `low` | |
| `parking_full` | `main_lot` | `warning` | |
| `energy_spike` | `lecture_hall_a` | `warning` | |

Unknown id returns 404 (WebSocket: an `error` message). The trigger reply is **not** a clean state: it adds
`status`, `scenario_id`, `sms_dispatch` next to the zones. Use the pushed `state` message for rendering.

### Strategy response (`generate_strategy`)

Request: `{"zone_id": "lecture_hall_a"}` (one of the four zone keys)

```json
{
  "diagnostic": "plain-English summary",
  "choices": [
    {"id": "1", "title": "...", "description": "...", "chart_data": [75, 60, 45, 30, 20]}
  ]
}
```
Always exactly 3 choices, each with exactly 5 integers (projected kW for the next 5 hours).
Ids are the strings `"1"`, `"2"`, `"3"`. Results are cached per zone until reset.
If the LLM fails or times out (8 s), a valid fallback in the same shape is returned.

---

## For Module 1 (vision / simulation)

- Keep writing only `lecture_hall_a` in `state.json`. Leave the other zones alone.
- Write atomically (`state.json.tmp` then `os.replace`).
- **Do not write while `_meta.demo_mode` is true**: re-read the file right before writing and skip if it is true.
- Do not add zones or statuses outside the table above. Every write is pushed to WebSocket clients automatically.

```python
live_state = read_state()                      # re-read right before writing
if live_state.get("_meta", {}).get("demo_mode") is True:
    continue                                   # demo mode: camera must not write
```

- `demo_payloads.py` must expose `DEMO_PAYLOADS = {scenario_id: (zone_key, fields_to_update)}`; Module 2 imports it.

## For Module 3 (map)

- Open the WebSocket, keep the latest `state` message, draw only the four zone keys (skip `_meta`).
- The zone key is `lecture_hall_a` (not `lecture_hall`).
- Colors: `normal` #333333 · `low` #FBBF24 (amber) · `warning` #F97316 · `critical` #EF4444.
- HUD buttons send `{"action": "trigger", ...}` and `{"action": "reset"}` over the socket.
- Clicking a `warning` zone opens the Module 4 drawer and passes the zone key as `zone_id`.

## For Module 4 (drawer)

- Send `{"action": "generate_strategy", "zone_id": <zone key>}` and wait for the `strategy` message.
- Render `diagnostic`, 3 cards (`id`, `title`, `description`) and a chart from `chart_data` (5 points).
- A live AI call can take a few seconds. Show a loading state; a 2.5 s cutoff will often fire before the answer arrives.
- `water_leak` (critical) is handled by SMS and does not need a strategy.
- A flat zero line in `chart_data` is valid output for an "all off" strategy.