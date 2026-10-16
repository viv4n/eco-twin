'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Zap, ChevronRight, AlertTriangle, Smartphone, Wifi, WifiOff } from 'lucide-react';
import PredictionGraph from './PredictionGraph';
import { API_BASE_URL } from '../utils/config';
import { useCampusStore } from '../context/CampusStoreContext';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zoneId: string | null;
}

interface Choice {
  id: string;
  title: string;
  desc: string;
  delta: string;
  projectedData: number[];
}

interface DrawerData {
  name: string | null;
  type: 'emergency' | 'low' | 'standard';
  diagnostic: string;
  choices: Choice[];
  statusBadge?: string;
}

/**
 * Resolves the backend state.json zone key from the zone name/id clicked on the map.
 * campusConfig uses short IDs like "lecture_hall_1", but backend uses "soe_lecture_hall_1".
 */
const resolveBackendKey = (
  zoneId: string | null,
  telemetry: Record<string, any>
): string | null => {
  if (!zoneId) return null;

  const lower = zoneId.toLowerCase().replace(/[\s-]+/g, '_');

  // 1. Direct key hit
  if (telemetry[lower]) return lower;

  // 2. Match on zone .name field
  for (const [key, val] of Object.entries(telemetry)) {
    if (val && typeof val === 'object' && String(val.name || '').toLowerCase() === zoneId.toLowerCase()) {
      return key;
    }
  }

  // 3. Backend key contains frontend ID substring (e.g. "lecture_hall_1" → "soe_lecture_hall_1")
  for (const key of Object.keys(telemetry)) {
    if (key.includes(lower) || lower.includes(key)) return key;
  }

  return null;
};

const getMockData = (id: string | null, liveZone?: any): DrawerData => {
  const zoneName = (id || '').toLowerCase();
  const status = String(liveZone?.status || 'normal').toLowerCase();

  // Emergency: critical status for server rooms, hospitals or pipe leaks
  const isEmergency =
    status === 'critical' &&
    (zoneName.includes('hospital') ||
      zoneName.includes('server') ||
      zoneName.includes('pipe') ||
      zoneName.includes('water'));

  if (isEmergency) {
    let diagText =
      'Critical failure detected. Life safety protocols or severe data loss risk active. Immediate automated intervention required.';
    if (liveZone?.system_state === 'cooling_failure')
      diagText = `Server room thermal anomaly: ${liveZone?.temperature_c ?? '--'}°C. Critical cooling failure. Automated failsafe engaged.`;
    else if (liveZone?.leak_detected)
      diagText = `Pipeline pressure critical: ${liveZone?.water_pressure_psi ?? '--'} PSI. Leak detected. Emergency isolation recommended.`;

    return {
      name: liveZone?.name || id,
      type: 'emergency',
      diagnostic: diagText,
      choices: [],
      statusBadge: 'CRITICAL',
    };
  }

  // Parking zones
  if (zoneName.includes('parking')) {
    const pct = liveZone?.occupancy_pct || '60%';
    return {
      name: liveZone?.name || id,
      type: status === 'critical' || status === 'warning' ? 'standard' : 'low',
      diagnostic: `Parking occupancy at ${pct}.${status === 'critical' ? ' Bay overflow threshold breached.' : status === 'warning' ? ' Approaching capacity limit.' : ''}`,
      choices: [
        { id: '1', title: 'Dynamic Traffic Detour', desc: 'Redirects inbound commuters to secondary lot.', delta: '-45% Inflow', projectedData: [98, 85, 72, 60, 50] },
        { id: '2', title: 'Express Gate Throttle', desc: 'Adjusts barrier entry cadence.', delta: '-20% Inflow', projectedData: [98, 92, 85, 80, 75] },
        { id: '3', title: 'Maintain Active Gate', desc: 'Sustains standard entry flow.', delta: '0% Delta', projectedData: [98, 98, 95, 90, 85] },
      ],
      statusBadge: status === 'critical' ? 'CRITICAL' : status === 'warning' ? 'WARNING' : undefined,
    };
  }

  // Stadiums
  if (zoneName.includes('stadium') || zoneName.includes('football') || zoneName.includes('cricket')) {
    return {
      name: liveZone?.name || id,
      type: 'low',
      diagnostic: `Floodlight consumption: ${liveZone?.power_consumption_kw ?? 150} kW detected outside scheduled match hours.`,
      choices: [
        { id: '1', title: 'Kill Floodlights', desc: 'Remotely cuts power to stadium light masts.', delta: '-100% Load', projectedData: [75, 0, 0, 0, 0] },
      ],
      statusBadge: status === 'warning' ? 'WARNING' : undefined,
    };
  }

  // Energy / HVAC / Classroom default
  const powerKw = liveZone?.power_consumption_kw;
  const co2 = liveZone?.co2_ppm;
  const hvac = liveZone?.hvac_status;
  const diagParts: string[] = [];
  if (hvac === 'overconsuming')
    diagParts.push(`HVAC overconsuming: ${powerKw ?? '--'} kW (+${liveZone?.baseline_variance_pct ?? '?'} vs baseline).`);
  else if (hvac === 'failed')
    diagParts.push('HVAC unit failure detected. Thermal comfort risk elevated.');
  if (co2 && co2 > 900)
    diagParts.push(`CO₂ at ${co2} ppm — ventilation intervention required.`);
  if (diagParts.length === 0)
    diagParts.push('HVAC system operating within nominal thermal and energy parameters.');

  return {
    name: liveZone?.name || id || 'Campus Zone',
    type: 'standard',
    diagnostic: diagParts.join(' '),
    choices: [
      { id: '1', title: 'Aggressive Shutdown', desc: 'Powers down AHU-02 & AHU-03.', delta: '-38%', projectedData: [75, 55, 42, 35, 34] },
      { id: '2', title: 'Moderate Setback', desc: 'Adjusts setpoint by +2.5°C.', delta: '-18%', projectedData: [75, 68, 62, 52, 48] },
      { id: '3', title: 'Maintain Baseline', desc: 'Maintains active schedule.', delta: '0%', projectedData: [75, 75, 70, 60, 55] },
    ],
    statusBadge: status === 'critical' ? 'CRITICAL' : status === 'warning' ? 'WARNING' : undefined,
  };
};

export default function Drawer({ isOpen, onClose, zoneId }: DrawerProps) {
  const [selectedChoice, setSelectedChoice] = useState<number>(0);
  const { telemetry, isConnected } = useCampusStore();

  // Resolve backend telemetry key from zone name/id passed from map click
  const backendKey = resolveBackendKey(zoneId, telemetry);
  const liveZone = backendKey ? telemetry[backendKey] : undefined;

  const data = getMockData(zoneId, liveZone);

  useEffect(() => {
    setSelectedChoice(0);
  }, [zoneId]);

  // Camera ID for MJPEG feed URL: prefer backend snake_case key, fallback to URL-encoded name
  const cameraId = backendKey || encodeURIComponent(zoneId || 'cam_01');
  const showCameraFeed =
    zoneId?.toLowerCase().includes('lecture_hall') ||
    zoneId?.toLowerCase().includes('lecture hall') ||
    zoneId?.toLowerCase().includes('parking') ||
    data.type === 'emergency';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center pointer-events-none p-4">

          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-md pointer-events-auto"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-[900px] max-w-[95vw] flex flex-col gap-4 pointer-events-auto"
          >
            {/* Header Pill */}
            <div className="flex justify-between items-center bg-slate-950/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${data.type === 'emergency' ? 'bg-red-600' : 'bg-rose-500'}`} />
                  {data.name}
                  {data.statusBadge && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                        data.statusBadge === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      }`}
                    >
                      {data.statusBadge}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">Active Intelligence Feed</p>
                  {isConnected ? (
                    <Wifi size={10} className="text-emerald-400" />
                  ) : (
                    <WifiOff size={10} className="text-slate-600" />
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Camera MJPEG Feed from FastAPI */}
            {showCameraFeed && (
              <div className="rounded-2xl overflow-hidden border border-emerald-500/30 bg-slate-950/80 shadow-2xl relative">
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1 rounded-lg bg-black/80 backdrop-blur-md text-xs font-mono text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold">LIVE OPTICAL CV FEED • {data.name}</span>
                </div>
                <img
                  src={`${API_BASE_URL}/api/v1/vision/feed/${cameraId}`}
                  alt="Live CCTV Camera Feed"
                  className="w-full h-52 object-cover bg-slate-900"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Live Sensor Readings Row (populated from backend telemetry) */}
            {liveZone && (
              <div className="flex gap-3 flex-wrap">
                {liveZone.temperature_c !== undefined && (
                  <div className="bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono">
                    <span className="text-slate-400">TEMP </span>
                    <span className="text-white font-bold">{liveZone.temperature_c}°C</span>
                  </div>
                )}
                {liveZone.power_consumption_kw !== undefined && (
                  <div className="bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono">
                    <span className="text-slate-400">POWER </span>
                    <span className="text-white font-bold">{liveZone.power_consumption_kw} kW</span>
                  </div>
                )}
                {liveZone.water_pressure_psi !== undefined && (
                  <div className="bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono">
                    <span className="text-slate-400">PRESSURE </span>
                    <span className="text-white font-bold">{liveZone.water_pressure_psi} PSI</span>
                  </div>
                )}
                {liveZone.co2_ppm !== undefined && (
                  <div className="bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono">
                    <span className="text-slate-400">CO₂ </span>
                    <span className="text-white font-bold">{liveZone.co2_ppm} ppm</span>
                  </div>
                )}
                {liveZone.occupancy !== undefined && (
                  <div className="bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono">
                    <span className="text-slate-400">OCCUPANCY </span>
                    <span className="text-white font-bold">{liveZone.occupancy}</span>
                  </div>
                )}
                {liveZone.occupancy_pct !== undefined && (
                  <div className="bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono">
                    <span className="text-slate-400">BAY FILL </span>
                    <span className="text-white font-bold">{liveZone.occupancy_pct}</span>
                  </div>
                )}
                {liveZone.hvac_status !== undefined && (
                  <div className="bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono">
                    <span className="text-slate-400">HVAC </span>
                    <span className={`font-bold ${liveZone.hvac_status === 'overconsuming' || liveZone.hvac_status === 'failed' ? 'text-red-400' : 'text-white'}`}>
                      {liveZone.hvac_status}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Diagnostic Box */}
            <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center gap-2 text-rose-400 mb-2 font-mono text-xs uppercase tracking-widest">
                <Activity size={14} /> System Diagnostic
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">{data.diagnostic}</p>
            </div>

            {/* Dynamic Protocol Choices */}
            {data.type === 'emergency' ? (
              <div className="bg-red-950/40 border border-red-500/50 backdrop-blur-xl rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(220,38,38,0.15)]">
                <AlertTriangle size={48} className="text-red-500 mb-4 animate-bounce" />
                <h3 className="text-xl font-bold text-white mb-2">Emergency Protocol Auto-Engaged</h3>
                <p className="text-red-200 text-sm max-w-md mx-auto mb-4">
                  Manual intervention disabled. Emergency responders and facility management have been automatically notified.
                </p>
                <div className="flex items-center gap-2 text-xs font-mono bg-red-950/80 px-4 py-2 rounded-lg text-red-400 border border-red-500/30">
                  <Smartphone size={14} /> SMS DISPATCHED TO FACILITY COMMAND
                </div>
              </div>
            ) : (
              <div className="flex flex-row gap-4">
                {data.choices.map((choice, index) => (
                  <div
                    key={choice.id}
                    onClick={() => setSelectedChoice(index)}
                    className={`flex-1 p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between shadow-2xl backdrop-blur-xl ${
                      selectedChoice === index
                        ? 'border-emerald-500/50 bg-emerald-950/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                        : 'border-white/10 bg-slate-950/80 hover:bg-slate-900/90'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <Zap size={20} className={selectedChoice === index ? 'text-emerald-400' : 'text-slate-500'} />
                        <span
                          className={`text-[10px] px-2 py-1 rounded font-mono font-bold tracking-wider ${
                            selectedChoice === index ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {choice.delta}
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-slate-100 mb-2 leading-tight">{choice.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{choice.desc}</p>
                    </div>
                    <div
                      className={`h-1 w-full rounded-full mt-4 transition-colors ${
                        selectedChoice === index ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/10'
                      }`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Recharts Live Predictive Graph */}
            {data.type !== 'emergency' && (
              <div className="h-56 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                <PredictionGraph projectedData={data.choices[selectedChoice]?.projectedData || [75, 75, 70, 60, 55]} />
              </div>
            )}

            {/* Execute CTA */}
            {data.type !== 'emergency' && (
              <button
                onClick={onClose}
                className="w-full bg-emerald-600/90 backdrop-blur-xl hover:bg-emerald-500 border border-emerald-400/30 text-white font-bold py-4 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.2)] transition flex items-center justify-center gap-2 text-sm uppercase tracking-widest cursor-pointer"
              >
                Execute Strategy <ChevronRight size={18} />
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}