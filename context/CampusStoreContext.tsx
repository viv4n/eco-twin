'use client';

/**
 * context/CampusStoreContext.tsx — DSU Smart Campus Digital Twin
 *
 * Fully synchronized with Module 2 backend:
 * - mainx.py & main.py: Initial load via GET ${API_BASE_URL}/api/state
 * - realtime.py: Live WebSocket stream via ${WS_BASE_URL} (or /ws/state)
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
  pipe_junction_bwssb_1: ['Pipe Junction W-3', 'Pipe Junction W-1', 'water_utility'],
  science_block: ['Pipe Junction W-3', 'a_block', 'health_sciences'],
  cdsimer_hospital: ['Hospital', 'cdsimer'],
  main_server_room: ['Hospital', 'cdsimer', 'soe'],
  soe_center_of_engineering: ['SOE Center', 'soe'],
  soe_classroom_b4: ['Classroom B4', 'classroom_4', 'classroom_2'],
  soe_lecture_hall_1: ['Lecture Hall 1', 'lecture_hall_1'],
  soe_lecture_hall_4: ['Lecture Hall 4', 'lecture_hall_4'],
  lecture_hall_a: ['Lecture Hall 1', 'lecture_hall_1', 'soe_lecture_hall_1'],
  main_lot: ['parking_1', 'Parking 1'],
  parking_1: ['Parking 1', 'main_lot'],
  parking_3: ['Parking 3'],
  parking_5: ['Parking 5'],
  cafeteria: ['cafe_bits_bites', 'cafe_tummy_trails', 'cafe_food_truck', 'Bits and Bites (Cafe 2)'],
  football_stadium: ['Football Stadium', 'stadium_football'],
  cricket_stadium: ['Cricket Stadium', 'stadium_cricket'],
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
  /** Function to send an action over WebSocket (as supported by realtime.py) */
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

  // 1. Initial REST Load: GET ${API_BASE_URL}/api/state
  const fetchInitialState = useCallback(async () => {
    const targetUrl = `${API_BASE_URL}/api/state`;
    console.log("Fetching state from:", targetUrl);
    try {
      const res = await fetch(targetUrl, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Fetch Error:", res.status, errorText);

        // Fallback check for /api/v1/telemetry/state
        if (res.status === 404) {
          const fallbackUrl = `${API_BASE_URL}/api/v1/telemetry/state`;
          console.log("Attempting fallback fetch from:", fallbackUrl);
          const fallbackRes = await fetch(fallbackUrl, {
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const statePayload = fallbackData.zones || fallbackData.state || fallbackData;
            setTelemetry(statePayload);
            setLastUpdated(new Date().toISOString());
            setLastError(null);
            setIsLoading(false);
            return;
          }
        }
        throw new Error(`HTTP ${res.status}: ${errorText || 'Failed to fetch state'}`);
      }

      const data = await res.json();
      const statePayload = data.zones || data.state || data;
      if (statePayload && typeof statePayload === 'object') {
        setTelemetry(statePayload);
      }
      setLastUpdated(new Date().toISOString());
      setLastError(null);
    } catch (err: any) {
      console.error("State Fetch Failure:", err);
      setLastError(err?.message || 'Failed to fetch initial state');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. WebSocket Live Stream: Connect to ${WS_BASE_URL} (realtime.py /ws/state)
  const connectWebSocket = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Determine target WebSocket URL: if WS_BASE_URL ends with '/ws', append '/state' to match realtime.py
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

          // Handle realtime.py message shapes
          if (data.type === 'state' && data.data) {
            // {"type": "state", "data": {...}}
            setTelemetry(data.data);
          } else if (data.zones && typeof data.zones === 'object') {
            setTelemetry(data.zones);
          } else if (data.type === 'ack' && data.data) {
            // Acknowledgment with updated state
            const stateData = data.data.zones || data.data.state || data.data;
            if (stateData && typeof stateData === 'object') {
              setTelemetry(stateData);
            }
          } else if (data.zone_id && (data.status || data.aspect)) {
            // Single zone partial update
            setTelemetry((prev) => ({
              ...prev,
              [data.zone_id]: {
                ...(prev[data.zone_id] || {}),
                ...data,
              },
            }));
          } else if (!data.type && !data.action) {
            // Direct state dictionary (e.g., when ENVELOPE = False)
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
          }, 3000);
        }
      };
    } catch {
      setIsConnected(false);
      if (!isUnmountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
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
      const isTriggered = status === 'warning' || status === 'critical' || status === 'critical_waste' || status === 'low';

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
