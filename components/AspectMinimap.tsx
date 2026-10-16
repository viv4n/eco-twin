'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { campusZones, CAMPUS_CENTER, CampusZone } from '../campusConfig';

export type AspectType = 'energy' | 'water' | 'parking' | 'occupancy' | 'irrigation' | 'emergency';

interface AspectMinimapProps {
  aspect: AspectType;
  selectedZoneId: string | null;
  triggeredZoneIds: string[];
  onSelectZone: (zone: CampusZone) => void;
}

// Calculate the center point of polygon coordinates
const getZoneCenter = (coords: [number, number][]): [number, number] => {
  if (!coords || coords.length === 0) return CAMPUS_CENTER;
  const latSum = coords.reduce((acc, c) => acc + c[0], 0);
  const lngSum = coords.reduce((acc, c) => acc + c[1], 0);
  return [latSum / coords.length, lngSum / coords.length];
};

// Controller to smoothly pan/zoom Leaflet map to the selected zone or aspect focus
function MapFocusController({ targetCenter }: { targetCenter: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(targetCenter, 17.5, {
      duration: 0.8,
      easeLinearity: 0.25,
    });
  }, [targetCenter, map]);

  return null;
}

export default function AspectMinimap({
  aspect,
  selectedZoneId,
  triggeredZoneIds,
  onSelectZone,
}: AspectMinimapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter campus zones relevant to this aspect
  const filteredZones: CampusZone[] = useMemo(() => {
    switch (aspect) {
      case 'water':
        return campusZones.filter(
          (z) => z.category === 'pipe_sensor' || z.category === 'utility' || z.id.includes('water')
        );
      case 'parking':
        return campusZones.filter((z) => z.category === 'parking');
      case 'occupancy':
        return campusZones.filter((z) => z.category === 'classroom' || z.category === 'lecture_hall');
      case 'irrigation':
        return campusZones.filter((z) => z.category === 'garden');
      case 'emergency':
        return campusZones.filter((z) => z.id.includes('hospital') || z.category === 'building');
      case 'energy':
      default:
        return campusZones.filter((z) => ['building', 'utility', 'hostel'].includes(z.category));
    }
  }, [aspect]);

  // Determine center point based on selected zone, triggered zone, or campus centroid
  const mapCenter: [number, number] = useMemo(() => {
    if (selectedZoneId) {
      const activeZone = filteredZones.find((z) => z.id === selectedZoneId || z.name === selectedZoneId);
      if (activeZone && activeZone.coordinates.length > 0) {
        return getZoneCenter(activeZone.coordinates);
      }
    }

    const firstTriggered = filteredZones.find(
      (z) => triggeredZoneIds.includes(z.id) || triggeredZoneIds.includes(z.name)
    );
    if (firstTriggered && firstTriggered.coordinates.length > 0) {
      return getZoneCenter(firstTriggered.coordinates);
    }

    if (filteredZones.length > 0 && filteredZones[0].coordinates.length > 0) {
      return getZoneCenter(filteredZones[0].coordinates);
    }

    return CAMPUS_CENTER;
  }, [filteredZones, selectedZoneId, triggeredZoneIds]);

  // Helper to generate sleek custom divIcons with blinkers
  const getMinimapIcon = useMemo(() => {
    return (isTriggered: boolean, isSelected: boolean) => {
      if (typeof window === 'undefined') return undefined;

      if (isTriggered) {
        return L.divIcon({
          className: 'minimap-beacon-icon',
          html: `
            <div class="relative flex items-center justify-center w-8 h-8 ${isSelected ? 'scale-125' : ''}">
              <span class="absolute w-7 h-7 rounded-full bg-red-500 opacity-75 animate-ping"></span>
              <span class="absolute w-5 h-5 rounded-full bg-red-500/30"></span>
              <span class="relative w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,1)] border-2 ${isSelected ? 'border-yellow-300 ring-2 ring-white' : 'border-white'}"></span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
      }

      // Nominal marker with highlight if selected
      const dotStyle = isSelected
        ? 'w-3.5 h-3.5 bg-blue-400 border-2 border-white ring-2 ring-blue-400 shadow-[0_0_12px_rgba(59,130,246,1)] scale-125'
        : 'w-2.5 h-2.5 bg-cyan-400 border border-white shadow-[0_0_8px_rgba(6,182,212,0.8)]';

      return L.divIcon({
        className: 'minimap-nominal-icon',
        html: `
          <div class="relative flex items-center justify-center w-6 h-6 hover:scale-125 transition-transform cursor-pointer">
            <span class="relative rounded-full ${dotStyle}"></span>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div className="w-full h-full relative overflow-hidden rounded-xl bg-slate-950">
      <style jsx global>{`
        .minimap-label {
          background: rgba(15, 23, 42, 0.9) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 6px !important;
          color: #f1f5f9 !important;
          font-family: monospace !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          padding: 2px 6px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
        }
        .minimap-label:before {
          display: none !important;
        }
      `}</style>

      <MapContainer
        center={mapCenter}
        zoom={17}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <MapFocusController targetCenter={mapCenter} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {filteredZones.map((zone) => {
          const isTriggered = triggeredZoneIds.includes(zone.id) || triggeredZoneIds.includes(zone.name);
          const isSelected = selectedZoneId === zone.id || selectedZoneId === zone.name;
          const center = getZoneCenter(zone.coordinates);

          const icon = getMinimapIcon(isTriggered, isSelected);
          if (!icon) return null;

          return (
            <Marker
              key={zone.id}
              position={center}
              icon={icon}
              eventHandlers={{
                click: () => onSelectZone(zone),
              }}
            >
              <Tooltip permanent={isSelected || isTriggered} direction="top" offset={[0, -10]} className="minimap-label">
                {zone.name}
              </Tooltip>

              <Popup>
                <div className="p-1 font-sans text-slate-900">
                  <div className="font-bold text-xs">{zone.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                    Category: {zone.category}
                  </div>
                  <div className={`text-[10px] font-bold mt-1 ${isTriggered ? 'text-red-600' : 'text-emerald-600'}`}>
                    {isTriggered ? 'STATUS: ANOMALY ACTIVE' : 'STATUS: NOMINAL'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Status Bar Overlay */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-slate-950/85 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">{filteredZones.length} Assets Monitored</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-red-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>{triggeredZoneIds.length} Alerts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
