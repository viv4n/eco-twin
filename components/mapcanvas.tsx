'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { campusZones, CAMPUS_CENTER } from '../campusConfig';
import { useTheme } from '../context/ThemeContext';

interface MapCanvasProps {
  onSelectZone: (id: string | null) => void;
  /**
   * Zone IDs (matching CampusZone.id OR .name) that are currently in
   * 'warning' or 'critical' state, injected from CampusStoreContext.
   * Falls back to a static demo list if omitted (backend not running).
   */
  triggeredZoneIds?: string[];
}

// Fallback static list used when the backend is not reachable.
// Mirrors the original hardcoded set so the map always looks correct.
const FALLBACK_TRIGGERED_ZONES: string[] = [
  'Pipe Junction W-3',
  'Classroom B4',
  'Classroom 4',
  'SOE Center',
  'Parking 1',
  'Garden Zone 3',
  'Hospital',
];

export default function MapCanvas({ onSelectZone, triggeredZoneIds }: MapCanvasProps) {
  const { theme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [stealthMode, setStealthMode] = useState(true);

  // Use live backend data if provided, otherwise fall back to the static demo list
  const activeTriggeredZones = triggeredZoneIds ?? FALLBACK_TRIGGERED_ZONES;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const stealthCategories = ['garden', 'lecture_hall', 'classroom', 'pipe_sensor'];

  const criticalZoneList = ['Pipe Junction W-3', 'Hospital', 'SOE Center', 'Classroom 4', 'Parking 1', 'Garden Zone 3'];

  // Helper to generate custom divIcons for glowing pointers
  const getMarkerIcon = useMemo(() => {
    return (severity: 'critical' | 'warning' | 'nominal', isTriggered: boolean) => {
      if (typeof window === 'undefined') return undefined;

      if (isTriggered) {
        const isCritical = severity === 'critical';
        const pingColor = isCritical ? 'bg-red-500' : 'bg-amber-500';
        const haloColor = isCritical ? 'bg-red-500/30' : 'bg-amber-500/30';
        const dotColor = isCritical 
          ? 'bg-red-500 shadow-[0_0_16px_rgba(239,68,68,1)]' 
          : 'bg-amber-500 shadow-[0_0_16px_rgba(245,158,11,1)]';

        return L.divIcon({
          className: 'custom-blinker-marker',
          html: `
            <div class="relative flex items-center justify-center w-8 h-8">
              <span class="absolute w-7 h-7 rounded-full ${pingColor} opacity-75 animate-ping"></span>
              <span class="absolute w-5 h-5 rounded-full ${haloColor}"></span>
              <span class="relative w-3.5 h-3.5 rounded-full ${dotColor} border-2 border-white"></span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
      }

      // Normal / Healthy asset pointer
      return L.divIcon({
        className: 'custom-nominal-marker',
        html: `
          <div class="relative flex items-center justify-center w-6 h-6 opacity-80 hover:opacity-100 hover:scale-125 transition-all">
            <span class="relative w-2.5 h-2.5 rounded-full border border-white" style="background-color: ${theme.accent}; box-shadow: 0 0 10px ${theme.accent};"></span>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    };
  }, [theme.accent]);

  // Helper to calculate polygon centre for marker placement
  const getZoneCenter = (coords: [number, number][]): [number, number] => {
    if (!coords || coords.length === 0) return CAMPUS_CENTER;
    const latSum = coords.reduce((acc, c) => acc + c[0], 0);
    const lngSum = coords.reduce((acc, c) => acc + c[1], 0);
    return [latSum / coords.length, lngSum / coords.length];
  };

  if (!isMounted) return null;

  return (
    <div className="w-full h-full relative">
      <style jsx global>{`
        .leaflet-interactive:focus {
          outline: none !important;
        }
        path.leaflet-interactive {
          outline: none !important;
        }
        .custom-map-label {
          background: rgba(15, 23, 42, 0.9) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #f8fafc !important;
          padding: 2px 8px !important;
        }
        .leaflet-tooltip-top:before,
        .leaflet-tooltip-bottom:before,
        .leaflet-tooltip-left:before,
        .leaflet-tooltip-right:before {
          display: none !important;
        }
      `}</style>

      {/* Floating Stealth Mode Toggle Button - repositioned cleanly to top-left corner */}
      <div 
        className="absolute top-4 left-4 z-30 flex items-center gap-2.5 backdrop-blur-xl border px-3.5 py-2 rounded-2xl shadow-2xl transition-colors duration-300"
        style={{ backgroundColor: theme.panelBg, borderColor: theme.borderColor }}
      >
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">Stealth Mode</span>
        <button
          onClick={() => setStealthMode(!stealthMode)}
          className="px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all border"
          style={{
            backgroundColor: stealthMode ? theme.activeBg : 'rgba(244,63,94,0.2)',
            borderColor: stealthMode ? theme.activeBorder : 'rgba(244,63,94,0.4)',
            color: stealthMode ? theme.accent : '#fb7185',
            boxShadow: stealthMode ? `0 0 12px ${theme.glowColor}` : '0 0 12px rgba(244,63,94,0.3)',
          }}
        >
          {stealthMode ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
        </button>
      </div>

      <MapContainer
        center={CAMPUS_CENTER}
        zoom={17}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {campusZones.map((zone) => {
          const isStealthCategory = stealthCategories.includes(zone.category);
          // Use live backend-driven list (or fallback) for trigger state
          const isTriggered = activeTriggeredZones.includes(zone.name) || activeTriggeredZones.includes(zone.id);
          const shouldHide = stealthMode && isStealthCategory && !isTriggered;

          if (shouldHide) return null;

          const centerPoint = getZoneCenter(zone.coordinates);
          const severity: 'critical' | 'warning' | 'nominal' = isTriggered 
            ? (criticalZoneList.includes(zone.name) || criticalZoneList.includes(zone.id) ? 'critical' : 'warning') 
            : 'nominal';

          const markerIcon = getMarkerIcon(severity, isTriggered);
          if (!markerIcon) return null;

          return (
            <Marker
              key={zone.id}
              position={centerPoint}
              icon={markerIcon}
              eventHandlers={{
                click: () => {
                  onSelectZone(zone.name);
                },
              }}
            >
              <Tooltip 
                permanent={isTriggered} 
                direction="top" 
                offset={[0, -12]}
                className="custom-map-label select-none pointer-events-none"
              >
                {zone.name}
              </Tooltip>

              <Popup>
                <div className="text-slate-900 font-sans p-1">
                  <h3 className="font-bold text-sm">{zone.name}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mt-0.5">
                    Category: {zone.category}
                  </p>
                  <p className={`text-[10px] font-bold mt-1 font-mono ${isTriggered ? 'text-red-600' : 'text-emerald-600'}`}>
                    {isTriggered ? 'STATUS: ACTIVE TELEMETRY ALERT' : 'STATUS: NOMINAL'}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}