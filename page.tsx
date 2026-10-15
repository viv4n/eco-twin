'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Drawer from '@/components/Drawer';

// Dynamically import MapCanvas to prevent Leaflet SSR server crashes
const MapCanvas = dynamic(() => import('@/components/mapcanvas'), { ssr: false });

export default function Home() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  return (
    <main className="w-screen h-screen relative overflow-hidden bg-slate-950">
      {/* Map takes full screen */}
      <MapCanvas onSelectZone={(zoneName) => setSelectedZone(zoneName)} />

      {/* Floating HUD Drawer opens when a zone is selected */}
      <Drawer 
        isOpen={Boolean(selectedZone)} 
        onClose={() => setSelectedZone(null)} 
        zoneId={selectedZone} 
      />
    </main>
  );
}
