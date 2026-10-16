'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DashboardLayout, { AspectType } from '@/components/DashboardLayout';
import Drawer from '@/components/Drawer';
import AspectWarRoomModal from '@/components/AspectWarRoomModal';
import DemoControls from '@/components/DemoControls';
import { useCampusStore } from '@/context/CampusStoreContext';

const MapCanvas = dynamic(() => import('@/components/mapcanvas'), { ssr: false });

export default function Home() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [activeAspect, setActiveAspect] = useState<AspectType | null>(null);

  // Live telemetry from backend — updates live via CampusStoreContext
  const { triggeredZoneIds } = useCampusStore();

  // Sync active aspect with URL search parameter (?aspect=water) on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const aspectParam = params.get('aspect') as AspectType | null;
      const validAspects: AspectType[] = ['energy', 'water', 'parking', 'occupancy', 'irrigation', 'emergency'];
      if (aspectParam && validAspects.includes(aspectParam)) {
        setActiveAspect(aspectParam);
      }
    }
  }, []);

  // Update state and mirror to URL search query string
  const handleSelectAspect = useCallback((aspect: AspectType | null) => {
    setActiveAspect(aspect);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (aspect) {
        url.searchParams.set('aspect', aspect);
      } else {
        url.searchParams.delete('aspect');
      }
      window.history.pushState({}, '', url.toString());
    }
  }, []);

  return (
    <DashboardLayout
      activeAspect={activeAspect}
      onSelectAspect={handleSelectAspect}
    >
      {/* 1. Underlying Leaflet Map Canvas remains mounted and untouched in the background.
              triggeredZoneIds are injected from the live backend store so that
              animate-ping markers reflect real backend state. */}
      <MapCanvas
        onSelectZone={(zoneName) => setSelectedZone(zoneName)}
        triggeredZoneIds={triggeredZoneIds}
      />

      {/* 2. Floating Strategy Drawer Modal for single zone clicks */}
      <Drawer
        isOpen={Boolean(selectedZone) && !activeAspect}
        onClose={() => setSelectedZone(null)}
        zoneId={selectedZone}
      />

      {/* 3. Full-screen Glassmorphism Aspect War Room Overlay Pop-up */}
      <AspectWarRoomModal
        isOpen={Boolean(activeAspect)}
        aspect={activeAspect}
        onClose={() => handleSelectAspect(null)}
        onSelectAspect={(asp) => handleSelectAspect(asp)}
      />

      {/* 4. Demo Remote Control Panel — fires FastAPI scenario triggers */}
      <DemoControls />
    </DashboardLayout>
  );
}