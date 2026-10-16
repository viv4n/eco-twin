/**
 * types/api.ts — DSU Smart Campus Digital Twin
 *
 * Production-ready TypeScript interfaces for:
 *   • Module 1: IoT Sensor Telemetry + YOLOv8 Edge CV Payloads
 *   • Module 2: REST Endpoint Response Contracts
 *   • WebSocket Real-time Event Payloads
 *   • Action Execution Request / Response
 *
 * Geographic coordinates follow Leaflet's [Lat, Lng] convention throughout.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SHARED / PRIMITIVE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The six campus aspect domains */
export type AspectType =
  | 'energy'
  | 'water'
  | 'parking'
  | 'occupancy'
  | 'irrigation'
  | 'emergency';

/** Three-tier severity classification */
export type ThresholdStatus = 'nominal' | 'warning' | 'critical';

/** Zone status values used across backend state and polling */
export type ZoneStatus = 'normal' | 'low' | 'warning' | 'critical' | 'critical_waste';

/** Leaflet-compatible geographic coordinate [Lat, Lng] */
export type LatLng = [number, number];

/** Campus zone category — mirrors campusConfig.ts CampusZone.category */
export type ZoneCategory =
  | 'building'
  | 'cafeteria'
  | 'parking'
  | 'lecture_hall'
  | 'classroom'
  | 'hostel'
  | 'sports'
  | 'garden'
  | 'utility'
  | 'pipe_sensor';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1-A  ·  IOT SENSOR TELEMETRY PAYLOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard telemetry pushed from any IoT edge node (energy, water, irrigation).
 *
 * Example JSON:
 * {
 *   "sensorId": "WS-PIPE-03",
 *   "zoneId": "Pipe Junction W-3",
 *   "aspect": "water",
 *   "metricValue": 18.4,
 *   "unit": "PSI",
 *   "thresholdStatus": "critical",
 *   "timestamp": "2026-10-16T04:55:00Z"
 * }
 */
export interface IoTSensorPayload {
  /** Unique hardware sensor identifier (e.g. "WS-PIPE-03", "HVAC-SOE-AHU02") */
  sensorId: string;
  /** Maps directly to CampusZone.id in campusConfig.ts */
  zoneId: string;
  /** Domain aspect this sensor measures */
  aspect: 'energy' | 'water' | 'irrigation';
  /** Raw numeric reading */
  metricValue: number;
  /** SI / Imperial unit string (e.g. "PSI", "kW", "°C", "%VWC") */
  unit: string;
  /** Alert classification computed by backend against historical baseline */
  thresholdStatus: ThresholdStatus;
  /** ISO 8601 UTC timestamp */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1-B  ·  YOLOV8 EDGE COMPUTER VISION CAMERA PAYLOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metrics specific to parking bays — derived from YOLOv8 object detection.
 *
 * Example JSON:
 * {
 *   "totalCapacity": 50,
 *   "occupiedSpots": 37,
 *   "availableSpots": 13,
 *   "twoWheelers": 22,
 *   "fourWheelers": 14,
 *   "evSlots": 1
 * }
 */
export interface ParkingVisionMetrics {
  totalCapacity: number;
  occupiedSpots: number;
  availableSpots: number;
  twoWheelers: number;
  fourWheelers: number;
  evSlots: number;
}

/**
 * Metrics specific to classroom / lecture hall occupancy — from YOLOv8 person detection.
 *
 * Example JSON:
 * {
 *   "currentHeadcount": 35,
 *   "maxCapacity": 60,
 *   "occupancyPercentage": 58.3
 * }
 */
export interface OccupancyVisionMetrics {
  currentHeadcount: number;
  maxCapacity: number;
  occupancyPercentage: number;
}

/**
 * Full payload emitted by a YOLOv8 edge camera per inference frame.
 *
 * Example JSON (parking):
 * {
 *   "cameraId": "CAM-PARK-01",
 *   "zoneId": "parking_1",
 *   "aspect": "parking",
 *   "modelInfo": "yolov8-campus-v1",
 *   "frameTimestamp": "2026-10-16T04:55:01.123Z",
 *   "inferenceFps": 12.4,
 *   "confidenceScore": 0.91,
 *   "detectedObjects": { "car": 14, "motorcycle": 22, "bus": 1 },
 *   "calculatedMetrics": {
 *     "totalCapacity": 50, "occupiedSpots": 37, "availableSpots": 13,
 *     "twoWheelers": 22, "fourWheelers": 14, "evSlots": 1
 *   }
 * }
 */
export interface YoloV8CVPayload {
  /** Unique camera hardware ID */
  cameraId: string;
  /** Maps to CampusZone.id in campusConfig.ts */
  zoneId: string;
  /** CV-capable domains */
  aspect: 'parking' | 'occupancy' | 'emergency';
  /** Model version string — always "yolov8-campus-v1" for this deployment */
  modelInfo: 'yolov8-campus-v1';
  /** ISO 8601 UTC timestamp of the camera frame */
  frameTimestamp: string;
  /** Real-time inference throughput in frames-per-second */
  inferenceFps: number;
  /** Model mean detection confidence (0.0 – 1.0) */
  confidenceScore: number;
  /**
   * Raw bounding-box counts per detected class label.
   * Keys are COCO class names (e.g. "car", "motorcycle", "person", "bus").
   */
  detectedObjects: Record<string, number>;
  /**
   * Higher-level derived metrics computed from detectedObjects.
   * Present when aspect is 'parking'; absent for 'occupancy' / 'emergency'.
   */
  calculatedMetrics: ParkingVisionMetrics | OccupancyVisionMetrics;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2  ·  REST ENDPOINT RESPONSE CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/v1/campus/zones ─────────────────────────────────────────────────

/**
 * Topology record used by MapCanvas.tsx for rendering Leaflet markers.
 *
 * Example JSON:
 * {
 *   "id": "parking_1",
 *   "name": "Parking 1",
 *   "category": "parking",
 *   "center": [12.66226, 77.45001],
 *   "stealthDefault": false
 * }
 */
export interface ZoneTopologyRecord {
  id: string;
  name: string;
  category: ZoneCategory;
  /** Computed polygon center — Leaflet [Lat, Lng] format */
  center: LatLng;
  /**
   * When true the zone should be invisible until triggered
   * (mirrors campusConfig stealthCategories logic).
   */
  stealthDefault: boolean;
}

export interface ZonesApiResponse {
  zones: ZoneTopologyRecord[];
  totalCount: number;
  /** ISO 8601 timestamp */
  generatedAt: string;
}

// ── GET /api/v1/telemetry/overview ───────────────────────────────────────────

/** Single item in the top alert ticker scrolling feed */
export interface TickerItem {
  id: string;
  /** Short human-readable headline, e.g. "Pipe Junction W-3 — Pressure Critical" */
  message: string;
  aspect: AspectType;
  severity: ThresholdStatus;
  /** ISO 8601 UTC timestamp */
  timestamp: string;
}

/**
 * Campus health overview — drives the right-panel telemetry gauges in DashboardLayout.tsx.
 *
 * Example JSON:
 * {
 *   "healthScore": 72,
 *   "triggeredZoneIds": ["Pipe Junction W-3", "Hospital", "Classroom 4"],
 *   "ticker": [...]
 * }
 */
export interface TelemetryOverviewResponse {
  /** 0–100 campus health score (100 = all nominal) */
  healthScore: number;
  /**
   * Zone IDs with active alerts — drives MapCanvas animate-ping markers
   * and stealth-mode un-hiding. Matches CampusZone.name OR .id.
   */
  triggeredZoneIds: string[];
  ticker: TickerItem[];
  /** ISO 8601 */
  polledAt: string;
}

// ── GET /api/v1/telemetry/zones/{zoneId} ─────────────────────────────────────

/** One item in the strategy choices array (mirrors Drawer.tsx Choice interface) */
export interface StrategyChoice {
  id: string;
  title: string;
  desc: string;
  /** Human-readable projected change label, e.g. "-38% Draw" */
  delta: string;
  /** 5-point Recharts LineChart trendline [t0, t1, t2, t3, t4] */
  projectedData: [number, number, number, number, number];
}

/**
 * Full zone diagnostic payload — consumed by Drawer.tsx and AspectWarRoomModal.tsx.
 *
 * Example JSON:
 * {
 *   "zoneId": "Pipe Junction W-3",
 *   "zoneName": "Water Node 3",
 *   "aspect": "water",
 *   "alertLevel": "critical",
 *   "diagnostic": "Acoustic telemetry detected abnormal pressure drop (-73%)...",
 *   "metricLabel": "Line Pressure (PSI)",
 *   "currentValue": 12.4,
 *   "unit": "PSI",
 *   "projectedTrend": [12, 10, 8, 6, 4],
 *   "parkingBreakdown": null,
 *   "occupancyData": null,
 *   "choices": [...],
 *   "lastUpdated": "2026-10-16T04:55:00Z"
 * }
 */
export interface ZoneDiagnosticResponse {
  zoneId: string;
  zoneName: string;
  aspect: AspectType;
  alertLevel: ThresholdStatus;
  /** Paragraph diagnostic text for Drawer.tsx and War Room Panel C */
  diagnostic: string;
  /** Y-axis label for Recharts charts, e.g. "Pressure (PSI)" */
  metricLabel: string;
  /** Latest sensor/CV reading */
  currentValue: number;
  unit: string;
  /** 5-point baseline + projected Recharts data */
  projectedTrend: [number, number, number, number, number];
  /**
   * Only non-null when aspect === "parking".
   * Powers the PieChart in Drawer.tsx and AspectWarRoomModal Panel C.
   */
  parkingBreakdown: ParkingVisionMetrics | null;
  /**
   * Only non-null when aspect === "occupancy".
   */
  occupancyData: OccupancyVisionMetrics | null;
  /** Response strategy options rendered in Drawer.tsx and War Room Panel C */
  choices: StrategyChoice[];
  lastUpdated: string;
}

// ── GET /api/v1/telemetry/aspects/{aspect}/logs ──────────────────────────────

/**
 * One row in the War Room Panel B alert history table.
 *
 * Example JSON:
 * {
 *   "id": "log-w3-20261016-001",
 *   "timestamp": "2026-10-16T04:22:11Z",
 *   "zoneName": "Water Node 3",
 *   "sensorMetric": "18.4 PSI",
 *   "severity": "critical",
 *   "actionTaken": "Valve Isolation dispatched"
 * }
 */
export interface AlertLogEntry {
  id: string;
  /** ISO 8601 */
  timestamp: string;
  zoneName: string;
  /** Formatted reading string shown in table, e.g. "18.4 PSI" */
  sensorMetric: string;
  severity: ThresholdStatus;
  actionTaken: string;
}

export interface AspectLogsResponse {
  aspect: AspectType;
  entries: AlertLogEntry[];
  totalCount: number;
}

// ── GET /api/v1/telemetry/state  (CampusStoreContext polling endpoint) ────────

/**
 * Per-zone live telemetry record.
 * Backend physically mutates this payload when scenarios are triggered.
 * Frontend stores it verbatim in CampusStoreContext — NO client-side math.
 *
 * Example JSON:
 * {
 *   "name": "Water Node 3",
 *   "category": "pipe_sensor",
 *   "aspect": "water",
 *   "status": "critical",
 *   "water_pressure_psi": 18.4,
 *   "vision_feed_active": false,
 *   "detection_confidence": null
 * }
 */

/**
 * Per-zone live telemetry record matching exact backend keys across:
 * - demo_payloads.py (36-zone DSU baseline and scenarios)
 * - state.py (normalized 4-zone demo state)
 * - vision.py (YOLOv8 vision inference state)
 */
export interface ZoneTelemetry {
  name?: string;
  category?: string;
  aspect?: AspectType | string;
  status: ZoneStatus | string;

  // Power & Electrical
  power_consumption_kw?: number;
  floodlights_state?: 'offline' | 'active' | string;
  hvac_status?: 'overconsuming' | 'active' | 'eco_mode' | 'failed' | string;
  hvac?: string;
  baseline_variance_pct?: string;

  // Water & Hydraulics
  water_pressure_psi?: number;
  water_usage_lpm?: number;
  water_flow?: string;
  flow_rate?: number;
  leak_detected?: boolean;

  // Environmental & Air Quality
  temperature_c?: number;
  temperature?: number;
  co2_ppm?: number;
  system_state?: 'life_safety_risk' | 'cooling_failure' | 'normal_cooling' | string;

  // Waste & Sanitation
  waste_level?: string;

  // Occupancy, Capacity & Parking
  occupancy?: number;
  occupancy_pct?: string | number;
  occupancy_rate?: string | number;
  total_capacity?: number;
  occupied_spots?: number;
  available_spots?: number;
  two_wheelers?: number;
  four_wheelers?: number;
  ev_slots?: number;

  // YOLOv8 Computer Vision (Module 1 / vision.py)
  vision_feed_active?: boolean;
  detection_confidence?: number;
  inference_fps?: number;
  effective_person_count?: number;

  // Alert & Dispatch
  automated_sms_dispatched?: boolean;

  // Catch-all for extra zone properties
  [key: string]: any;
}

/**
 * Full state snapshot returned by GET /api/state and GET /api/v1/telemetry/state.
 * Keys are zone identifier strings (e.g., "pipe_junction_bwssb_1", "parking_1", "soe_lecture_hall_1").
 */
export type TelemetryStateResponse = Record<string, ZoneTelemetry | any>;

// ─────────────────────────────────────────────────────────────────────────────
// MAINX.PY / REALTIME.PY BACKEND REST & WS CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

/** Twilio SMS Dispatch payload returned by trigger endpoints */
export interface SmsDispatchResult {
  status: 'sent' | 'skipped' | string;
  sid?: string;
  error?: string;
  reason?: string;
}

/** Response from POST /api/trigger/{scenario_id} */
export interface TriggerScenarioResponse {
  status: 'success' | string;
  scenario_id: string;
  sms_dispatch?: SmsDispatchResult | null;
  [zoneId: string]: any;
}

/** Response from POST /api/reset */
export interface ResetStateResponse {
  status: 'success' | string;
  _meta?: { demo_mode: boolean };
  [zoneId: string]: any;
}

/** Choice card structure returned by POST /api/generate_strategy */
export interface ChoiceCard {
  id: string;
  title: string;
  description: string;
  chart_data: [number, number, number, number, number] | number[];
}

/** Response from POST /api/generate_strategy */
export interface StrategyResponse {
  diagnostic: string;
  choices: ChoiceCard[];
}

/** Request payload for POST /api/generate_strategy */
export interface StrategyRequest {
  zone_id: string;
}

/** WebSocket message from server: {"type": "state", "data": { ... }} */
export interface WebSocketStateMessage {
  type: 'state';
  data: Record<string, ZoneTelemetry | any>;
}

/** WebSocket message from client to trigger/reset or request strategy */
export interface WebSocketClientCommand {
  action: 'trigger' | 'reset' | 'generate_strategy';
  scenario_id?: string;
  zone_id?: string;
}

/** WebSocket reply from server to client */
export interface WebSocketServerReply {
  type: 'ack' | 'strategy' | 'error';
  action?: string;
  data?: any;
  message?: string;
  zone_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2  ·  WEBSOCKET REAL-TIME EVENT PAYLOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ws://localhost:8000/telemetry/live
 *
 * Real-time anomaly events that activate/deactivate animate-ping Leaflet markers.
 *
 * ZONE_TRIGGERED example:
 * {
 *   "eventType": "ZONE_TRIGGERED",
 *   "zoneId": "parking_1",
 *   "zoneName": "Parking 1",
 *   "aspect": "parking",
 *   "severity": "warning",
 *   "trigger": "yolov8_overflow",
 *   "triggerDetail": "YOLOv8 detected 49/50 bays occupied — overflow threshold breached",
 *   "timestamp": "2026-10-16T04:55:03Z"
 * }
 *
 * ZONE_RESOLVED example:
 * {
 *   "eventType": "ZONE_RESOLVED",
 *   "zoneId": "parking_1",
 *   "zoneName": "Parking 1",
 *   "aspect": "parking",
 *   "severity": "nominal",
 *   "trigger": "operator_reset",
 *   "triggerDetail": "Scenario manually cleared by operator",
 *   "timestamp": "2026-10-16T05:10:00Z"
 * }
 */
export interface LiveTelemetryEvent {
  eventType: 'ZONE_TRIGGERED' | 'ZONE_RESOLVED';
  /** Maps to CampusZone.id */
  zoneId: string;
  /** Human-readable zone name */
  zoneName: string;
  aspect: AspectType;
  severity: ThresholdStatus;
  /**
   * Machine-readable trigger source:
   * "iot_threshold"     — IoT sensor crossed configured threshold
   * "yolov8_overflow"   — YOLOv8 detected parking / occupancy overflow
   * "yolov8_intrusion"  — YOLOv8 detected unauthorised person in restricted zone
   * "operator_reset"    — manual scenario reset via /api/trigger_demo?scenario=OFF
   * "auto_resolved"     — sensor reading returned to nominal range
   */
  trigger:
    | 'iot_threshold'
    | 'yolov8_overflow'
    | 'yolov8_intrusion'
    | 'operator_reset'
    | 'auto_resolved';
  /** Human-readable explanation sentence */
  triggerDetail: string;
  /** ISO 8601 UTC */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2  ·  ACTION EXECUTION  (POST /api/v1/actions/execute)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request body sent when operator clicks "Execute Strategy" in Drawer.tsx
 * or AspectWarRoomModal.tsx Panel C.
 *
 * Example JSON:
 * {
 *   "zoneId": "Pipe Junction W-3",
 *   "aspect": "water",
 *   "choiceId": "1",
 *   "executedBy": "operator-console",
 *   "timestamp": "2026-10-16T05:01:33Z"
 * }
 */
export interface ActionExecuteRequest {
  /** Maps to CampusZone.id */
  zoneId: string;
  aspect: AspectType;
  /** Matches StrategyChoice.id */
  choiceId: string;
  /** Audit identifier — "operator-console" for manual UI actions */
  executedBy: string;
  /** ISO 8601 UTC client timestamp */
  timestamp: string;
}

/**
 * Response returned by POST /api/v1/actions/execute.
 *
 * Example JSON:
 * {
 *   "success": true,
 *   "actionId": "ACT-20261016-0501-WN3-1",
 *   "confirmedAt": "2026-10-16T05:01:34Z",
 *   "expectedEffect": "Isolation valve closure estimated within 30s",
 *   "nextPollRecommendedMs": 2000
 * }
 */
export interface ActionExecuteResponse {
  success: boolean;
  /** Unique action audit log ID generated by backend */
  actionId: string;
  confirmedAt: string;
  /** Short human-readable description of the expected downstream effect */
  expectedEffect: string;
  /**
   * Milliseconds until the frontend should force-poll telemetry state
   * to observe the effect. Typically 2000ms.
   */
  nextPollRecommendedMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO CONTROL  ·  POST /api/trigger_demo?scenario=<id>
// ─────────────────────────────────────────────────────────────────────────────

/** Valid scenario identifiers accepted by the FastAPI demo endpoint */
export type DemoScenarioId =
  | 'water_leak'
  | 'cooling_failure'
  | 'energy_waste'
  | 'parking_congestion'
  | 'OFF';

