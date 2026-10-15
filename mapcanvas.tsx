'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { campusZones, CAMPUS_CENTER } from '../campusConfig';

export default function MapCanvas() {
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  
  // Empty state ready for real API data. No fake colors or triggers.
  const [zoneStates, setZoneStates] = useState<Record<string, any>>({});

  useEffect(() => {
    // Ensures text labels remain clean with no ugly Leaflet backgrounds
    const style = document.createElement('style');
    style.innerHTML = `
      div.leaflet-tooltip {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        color: black !important;
        font-weight: 900 !important;
        font-size: 11px !important;
        text-shadow: 2px 2px 4px white, -2px -2px 4px white, 2px -2px 4px white, -2px 2px 4px white !important;
      }
      div.leaflet-tooltip::before,
      div.leaflet-tooltip::after {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    // API Polling structure (waiting for your future FastAPI backend)
    const fetchState = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/state');
        if (!res.ok) throw new Error('Backend offline');
        const data = await res.json();
        setZoneStates(data);
      } catch (err) {}
    };
    
    const interval = setInterval(fetchState, 2000);
    return () => {
      document.head.removeChild(style);
      clearInterval(interval);
    };
  }, []);

  const handleZoneClick = (zoneId: string) => {
    console.log('Clicked zone:', zoneId);
    // Future integration: Open sidebar or show camera feed here
  };

  return (
    <div className="relative h-screen w-full bg-black">
      
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={() => setShowAllMarkers(!showAllMarkers)}
          className="bg-gray-900 border border-gray-600 text-white px-5 py-2 rounded shadow-xl hover:bg-gray-800 transition font-bold text-sm tracking-wide cursor-pointer"
        >
          {showAllMarkers ? 'Hide Overview (Stealth Mode)' : 'Show Map Overview'}
        </button>
      </div>

      <MapContainer center={CAMPUS_CENTER} zoom={17} className="h-full w-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {campusZones.map((zone) => {
          // Reads future API data, defaults to 'normal'
          const currentStatus = zoneStates[zone.id]?.status || 'normal';
          const alwaysStealthCategories = ['classroom', 'garden', 'lecture_hall'];
          
          // Stealth & Overview Hiding Logic
          if (currentStatus === 'normal') {
            if (!showAllMarkers) return null; 
            if (showAllMarkers && alwaysStealthCategories.includes(zone.category)) return null; 
          }

          return (
            <Polygon
              key={zone.id}
              positions={zone.coordinates}
              pathOptions={{
                stroke: false, // Prevents Leaflet from drawing border lines
                fill: false,   // Prevents Leaflet from drawing ugly gray shapes
              }}
              eventHandlers={{
                click: () => handleZoneClick(zone.id),
              }}
            >
              <Tooltip permanent direction="center">
                {/* 
                  Foundation for future Blinkers! 
                  The class dynamic class "status-[type]" makes it easy to hook in animations later 
                */}
                <div className={`zone-label status-${currentStatus}`}>
                  {zone.name}
                </div>
              </Tooltip>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
  );
}