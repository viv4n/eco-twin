'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { campusZones, CAMPUS_CENTER, CampusZone } from '../campusConfig';
import { useCampusStore } from '../context/CampusStoreContext';

interface MapCanvasProps {
  onSelectZone: (id: string | null) => void;
  triggeredZoneIds?: string[];
}

export default function MapCanvas({ onSelectZone, triggeredZoneIds: propTriggeredZoneIds }: MapCanvasProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [stealthMode, setStealthMode] = useState(true);

  // Live telemetry from WebSocket/REST via CampusStoreContext
  const { triggeredZoneIds: storeTriggeredZoneIds, isConnected } = useCampusStore();
  const triggeredZoneIds = propTriggeredZoneIds || storeTriggeredZoneIds;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const stealthCategories = ['garden', 'lecture_hall', 'classroom', 'pipe_sensor'];

  return (
    <div className="w-full h-screen relative">
      {/* Global CSS for Leaflet focus kill & custom label typography */}
      <style jsx global>{`
        .leaflet-interactive:focus {
          outline: none !important;
        }
        path.leaflet-interactive {
          outline: none !important;
        }
        .custom-map-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          letter-spacing: -0.01em !important;
          color: #0f172a !important;
          text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9), 0 0 8px rgba(255, 255, 255, 0.8) !important;
        }
        .leaflet-tooltip-top:before,
        .leaflet-tooltip-bottom:before,
        .leaflet-tooltip-left:before,
        .leaflet-tooltip-right:before {
          display: none !important;
        }
      `}</style>

      {/* Floating Stealth Mode Toggle + Live WS Connection Indicator */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-3 bg-slate-950/90 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl">
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Stealth Mode</span>
        <button
          onClick={() => setStealthMode(!stealthMode)}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
            stealthMode
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
          }`}
        >
          {stealthMode ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
        </button>
        {/* WebSocket live telemetry connection indicator */}
        <div
          title={isConnected ? 'Live telemetry — WebSocket connected' : 'Telemetry offline — reconnecting…'}
          className={`w-2 h-2 rounded-full transition-all ${
            isConnected
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
              : 'bg-slate-600'
          }`}
        />
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

        {campusZones.map((zone: CampusZone) => {
          const isStealthCategory = stealthCategories.includes(zone.category);

          // Match against zone.id, zone.name, or any alias the backend emits
          const isTriggered =
            triggeredZoneIds.includes(zone.id) ||
            triggeredZoneIds.includes(zone.name) ||
            triggeredZoneIds.some((t) => t.toLowerCase() === zone.id.toLowerCase()) ||
            triggeredZoneIds.some((t) => t.toLowerCase() === zone.name.toLowerCase());

          const shouldHide = stealthMode && isStealthCategory && !isTriggered;

          return (
            <Polygon
              key={zone.id}
              positions={zone.coordinates as any}
              pathOptions={{
                color: shouldHide ? 'transparent' : isTriggered ? '#ef4444' : 'transparent',
                fillColor: shouldHide ? 'transparent' : isTriggered ? '#f87171' : 'transparent',
                fillOpacity: shouldHide ? 0 : isTriggered ? 0.4 : 0,
                weight: 0,
              }}
              eventHandlers={{
                click: () => {
                  onSelectZone(zone.name);
                },
              }}
            >
              {!shouldHide && (
                <Tooltip
                  permanent
                  direction="center"
                  className="custom-map-label select-none pointer-events-none"
                >
                  {zone.name}
                </Tooltip>
              )}

              <Popup>
                <div className="text-slate-900 font-sans p-1">
                  <h3 className="font-bold text-base">{zone.name}</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">
                    Category: {zone.category}
                  </p>
                  {isTriggered && (
                    <p className="text-xs text-red-600 font-bold mt-1">⚠ ANOMALY DETECTED — Click for diagnostics</p>
                  )}
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
  );
}