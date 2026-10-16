'use client';

/**
 * context/CampusStoreContext.tsx — DSU Smart Campus Digital Twin
 *
 * Fully synchronized with Module 2 backend:
 * - Initial load via GET ${API_BASE_URL}/api/v1/telemetry/state & GET ${API_BASE_URL}/api/state
 * - Live WebSocket stream via ${WS_BASE_URL} (/ws/state) with 1-second continuous telemetry
 * - demo_payloads.py & state.py: 36-zone baseline and active telemetry synchronization
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { campusZones } from '../campusConfig';
import { API_BASE_URL, WS_BASE_URL } from '../utils/config';
import type { ZoneTelemetry } from '../types/api';

// Cross-alias mapping between backend zone keys and frontend campusConfig zone IDs/names
const ZONE_ALIAS_MAP: Record<string, string[]> = {
  // Water / Utilities
  pipe_junction_bwssb_1: ['Pipe Junction W-3', 'Pipe Junction W-1', 'water_utility', 'Water Node 1', 'Water Node 3', 'Water Utility'],
  cdsimer_hospital: ['Hospital', 'cdsimer', 'CDSIMER Center', 'hospital'],
  main_server_room: ['Hospital', 'cdsimer', 'soe', 'SOE Center', 'main_server_room'],
  water_utility: ['Water Utility', 'Pipe Junction W-1', 'Pipe Junction W-3'],

  // Academic & Classrooms
  soe_center_of_engineering: ['SOE Center', 'soe', 'soe_center_of_engineering'],
  soe_classroom_b4: ['Classroom B4', 'classroom_4', 'classroom_2', 'Classroom 4', 'soe_classroom_b4'],
  soe_classroom_a1: ['Classroom A1', 'classroom_1', 'Classroom 1', 'soe_classroom_a1'],
  pharmacy_classroom_1: ['Pharmacy Classroom 1', 'classroom_3', 'Classroom 3', 'pharmacy', 'pharmacy_classroom_1'],
  a_block: ['A Block', 'a_block'],
  nursing_block: ['Nursing Block', 'nursing', 'nursing_block'],
  health_sciences: ['Health Sciences', 'health_sciences'],
  pharmacy_department: ['Pharmacy', 'pharmacy', 'pharmacy_department'],

  // Lecture Halls
  soe_lecture_hall_1: ['Lecture Hall 1', 'lecture_hall_1', 'soe_lecture_hall_1'],
  soe_lecture_hall_2: ['Lecture Hall 2', 'lecture_hall_2', 'soe_lecture_hall_2'],
  soe_lecture_hall_3: ['Lecture Hall 3', 'lecture_hall_3', 'soe_lecture_hall_3'],
  soe_lecture_hall_4: ['Lecture Hall 4', 'lecture_hall_4', 'soe_lecture_hall_4'],
  soe_lecture_hall_5: ['Lecture Hall 5', 'lecture_hall_5', 'soe_lecture_hall_5'],
  soe_lecture_hall_6: ['Lecture Hall 6', 'lecture_hall_6', 'soe_lecture_hall_6'],

  // Parking
  parking_1: ['Parking 1', 'parking_1', 'main_lot'],
  parking_2: ['Parking 2', 'parking_2'],
  parking_3: ['Parking 3', 'parking_3'],
  parking_4: ['Parking 4', 'parking_4'],
  parking_5: ['Parking 5', 'parking_5'],

  // Hostels & Facilities
  hostel_1: ['Hostel 1', 'hostel_1'],
  hostel_2: ['Hostel 2', 'hostel_2'],
  hostel_3: ['Hostel 3', 'hostel_3'],
  girls_hostel_4: ['Girls Hostel 4', 'Hostel 4', 'hostel_4', 'girls_hostel_4'],
  laundry_facility: ['Laundry Facility', 'laundry', 'laundry_facility'],
  hostel_mess: ['Hostel Mess', 'hostel_mess'],

  // Cafeterias & Dining
  cafe_1_tummy_trails: ['Tummy Trails (Cafe 1)', 'cafe_tummy_trails', 'cafe_1_tummy_trails'],
  cafe_2_bits_and_bites: ['Bits and Bites (Cafe 2)', 'cafe_bits_bites', 'cafe_2_bits_and_bites'],
  cafe_4_food_truck: ['Food Truck (Cafe 4)', 'cafe_food_truck', 'cafe_4_food_truck'],

  // Sports & Recreation
  football_stadium: ['Football Stadium', 'stadium_football', 'Varsity Football Stadium'],
  cricket_stadium: ['Cricket Stadium', 'stadium_cricket'],
  amphitheatre: ['Amphitheatre', 'amphitheatre'],
  dsu_arena: ['DSU Arena', 'dsu_arena'],
  open_auditorium: ['Open Auditorium', 'open_auditorium'],

  // Legacy schema compatibility
  science_block: ['Pipe Junction W-3', 'a_block', 'health_sciences'],
  lecture_hall_a: ['Lecture Hall 1', 'lecture_hall_1', 'soe_lecture_hall_1'],
  main_lot: ['parking_1', 'Parking 1'],
  cafeteria: ['cafe_bits_bites', 'cafe_tummy_trails', 'cafe_food_truck', 'Bits and Bites (Cafe 2)'],
};

// Safe baseline state built from campusConfig zones
const buildBaselineState = (): Record<string, ZoneTelemetry> => {
  const baseline: Record<string, ZoneTelemetry> = {};

  campusZones.forEach((zone) => {
    let aspect: any = 'energy';
    if (zone.category === 'pipe_sensor' || zone.category === 'utility') aspect = 'water';
    else if (zone.category === 'parking') aspect = 'parking';
    else if (zone.category === 'classroom' || zone.category === 'lecture_hall') aspect = 'occupancy';
    else if (zone.category === 'garden') aspect = 'irrigation';
    else if (zone.id === 'hospital' || zone.id === 'health_sciences') aspect = 'emergency';

    baseline[zone.id] = {
      name: zone.name,
      category: zone.category,
      aspect,
      status: 'normal',
    };
  });

  return baseline;
};

interface CampusStoreContextValue {
  /** Full telemetry dictionary of campus zones */
  telemetry: Record<string, ZoneTelemetry | any>;
  /** Zone IDs and names in warning or critical status for MapCanvas radar markers */
  triggeredZoneIds: string[];
  /** Loading status for initial load */
  isLoading: boolean;
  /** WebSocket connection state */
  isConnected: boolean;
  /** Last fetch or WS error */
  lastError: string | null;
  /** Last updated ISO timestamp */
  lastUpdated: string | null;
  /** Function to manually refresh state from REST */
  refreshState: () => Promise<void>;
  /** Function to send an action over WebSocket (as supported by main.py) */
  sendWsAction: (action: string, payload?: Record<string, any>) => boolean;
}

const CampusStoreContext = createContext<CampusStoreContextValue>({
  telemetry: buildBaselineState(),
  triggeredZoneIds: [],
  isLoading: true,
  isConnected: false,
  lastError: null,
  lastUpdated: null,
  refreshState: async () => {},
  sendWsAction: () => false,
});

export function CampusStoreProvider({ children }: { children: React.ReactNode }) {
  const [telemetry, setTelemetry] = useState<Record<string, ZoneTelemetry | any>>(() => buildBaselineState());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef<boolean>(false);

  // 1. Initial REST Load: GET ${API_BASE_URL}/api/v1/telemetry/state with fallback to /api/state
  const fetchInitialState = useCallback(async () => {
    const urlsToTry = [
      `${API_BASE_URL}/api/v1/telemetry/state`,
      `${API_BASE_URL}/api/state`,
    ];

    let stateLoaded = false;
    for (const url of urlsToTry) {
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const statePayload = data.zones || data.state || data;
          if (statePayload && typeof statePayload === 'object' && Object.keys(statePayload).length > 0) {
            setTelemetry(statePayload);
            setLastUpdated(new Date().toISOString());
            setLastError(null);
            stateLoaded = true;
            break;
          }
        }
      } catch (err: any) {
        // Try fallback route
      }
    }

    if (!stateLoaded) {
      setLastError('Unable to connect to backend telemetry service.');
    }
    setIsLoading(false);
  }, []);

  // 2. WebSocket Live Stream: Connect to ${WS_BASE_URL} (/ws/state)
  const connectWebSocket = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const targetWsUrl = WS_BASE_URL.endsWith('/ws')
      ? `${WS_BASE_URL}/state`
      : WS_BASE_URL;

    try {
      const ws = new WebSocket(targetWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setLastError(null);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setLastUpdated(new Date().toISOString());

          if (!data || typeof data !== 'object') return;

          if (data.type === 'state' && data.data) {
            setTelemetry(data.data);
          } else if (data.zones && typeof data.zones === 'object') {
            setTelemetry(data.zones);
          } else if (data.type === 'ack' && data.data) {
            const stateData = data.data.zones || data.data.state || data.data;
            if (stateData && typeof stateData === 'object') {
              setTelemetry(stateData);
            }
          } else if (data.zone_id && (data.status || data.aspect)) {
            setTelemetry((prev) => ({
              ...prev,
              [data.zone_id]: {
                ...(prev[data.zone_id] || {}),
                ...data,
              },
            }));
          } else if (!data.type && !data.action) {
            setTelemetry(data);
          }
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (!isUnmountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 2000);
        }
      };
    } catch {
      setIsConnected(false);
      if (!isUnmountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2000);
      }
    }
  }, []);

  const sendWsAction = useCallback((action: string, payload?: Record<string, any>): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ action, ...payload }));
        return true;
      } catch (err) {
        console.error('Failed to send WS action:', err);
        return false;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;

    fetchInitialState();
    connectWebSocket();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchInitialState, connectWebSocket]);

  // Derive triggered zone IDs and names for MapCanvas animate-ping radar beacons
  const triggeredZoneIds = useMemo(() => {
    const ids = new Set<string>();

    Object.entries(telemetry).forEach(([key, val]: [string, any]) => {
      if (!val || typeof val !== 'object') return;
      const status = (val.status || '').toLowerCase();
      const isTriggered =
        status === 'warning' ||
        status === 'critical' ||
        status === 'critical_waste' ||
        status === 'low' ||
        val.leak_detected === true ||
        val.system_state === 'cooling_failure' ||
        val.system_state === 'life_safety_risk' ||
        val.hvac_status === 'overconsuming' ||
        val.hvac_status === 'failed';

      if (isTriggered) {
        // Add direct key and names
        ids.add(key);
        if (val.id) ids.add(val.id);
        if (val.name) ids.add(val.name);
        if (val.zone_id) ids.add(val.zone_id);

        // Add mapped frontend aliases
        const aliases = ZONE_ALIAS_MAP[key.toLowerCase()];
        if (aliases) {
          aliases.forEach((alias) => ids.add(alias));
        }
      }
    });

    return Array.from(ids);
  }, [telemetry]);

  const value: CampusStoreContextValue = {
    telemetry,
    triggeredZoneIds,
    isLoading,
    isConnected,
    lastError,
    lastUpdated,
    refreshState: fetchInitialState,
    sendWsAction,
  };

  return (
    <CampusStoreContext.Provider value={value}>
      {children}
    </CampusStoreContext.Provider>
  );
}

export function useCampusStore(): CampusStoreContextValue {
  return useContext(CampusStoreContext);
}
