'use client';
import dynamic from 'next/dynamic';

const MapCanvas = dynamic(() => import('../components/mapcanvas'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      <MapCanvas />
    </main>
  );
}