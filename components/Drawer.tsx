'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, AlertTriangle, Zap, Droplets, Car, Users, Leaf } from 'lucide-react';
import { 
  LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip,
  PieChart, Pie, Cell 
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useCampusStore } from '../context/CampusStoreContext';
import { API_BASE_URL } from '../utils/config';

interface Choice {
  id: string;
  title: string;
  desc: string;
  delta: string;
  projectedData: number[];
}

interface AspectData {
  name: string;
  type: 'emergency' | 'standard' | 'low';
  aspect: 'energy' | 'water' | 'parking' | 'occupancy' | 'irrigation' | 'emergency';
  diagnostic: string;
  metricLabel: string;
  choices: Choice[];
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zoneId: string | null;
}

const aspectIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  energy: Zap,
  water: Droplets,
  parking: Car,
  occupancy: Users,
  irrigation: Leaf,
  emergency: AlertTriangle,
};

// Vehicle breakdown for Parking pie chart visualization
const getParkingBreakdown = (zoneName: string) => {
  const isHighCap = zoneName.includes('1') || zoneName.includes('4');
  return [
    { name: '4-Wheelers', value: isHighCap ? 140 : 80, color: '#3b82f6' },
    { name: '2-Wheelers', value: isHighCap ? 85 : 55, color: '#06b6d4' },
    { name: 'EV Charging', value: isHighCap ? 20 : 15, color: '#10b981' },
    { name: 'Available Spots', value: isHighCap ? 5 : 50, color: '#475569' },
  ];
};

// Dynamic 6-Aspect Diagnostic Engine (No hardcoded single-node checks)
const getMockData = (id: string | null): AspectData => {
  const zoneName = (id || '').toLowerCase();
  const displayName = id || 'Campus Zone';
  
  // 1. Critical Emergencies (Hospital / Server Rooms)
  if (zoneName.includes('hospital') || zoneName.includes('server')) {
    return {
      name: displayName,
      type: 'emergency',
      aspect: 'emergency',
      diagnostic: `Critical life-safety or data-center alert active at ${displayName}. Autonomous containment active; manual controls restricted.`,
      metricLabel: 'System Status',
      choices: [],
    };
  }
  
  // 2. Pipe Leaks & Water Utilities (Dynamic for ANY pipe, water node, or utility)
  if (zoneName.includes('pipe') || zoneName.includes('water')) {
    return {
      name: displayName,
      type: 'standard',
      aspect: 'water',
      diagnostic: `Acoustic telemetry at ${displayName} detected an abnormal pressure drop (-58% against grid baseline). Potential subsurface joint fracture.`,
      metricLabel: 'Pressure (PSI)',
      choices: [
        { 
          id: '1', 
          title: `Emergency Valve Isolation (${displayName})`, 
          desc: `Closes automated isolation valves directly upstream and downstream of ${displayName}.`, 
          delta: '-100% Flow', 
          projectedData: [45, 10, 0, 0, 0] 
        },
        { 
          id: '2', 
          title: `Pressure Bypass & Loop Balance`, 
          desc: `Diverts flow around ${displayName} through secondary utility distribution lines.`, 
          delta: '+28 PSI Balanced', 
          projectedData: [45, 30, 38, 42, 45] 
        },
        { 
          id: '3', 
          title: `Dispatch Utility Crew`, 
          desc: `Transmits precise coordinates of ${displayName} to facilities maintenance for urgent field inspection.`, 
          delta: 'Auditing', 
          projectedData: [45, 42, 38, 30, 25] 
        },
      ],
    };
  }

  // 3. Parking Availability
  if (zoneName.includes('parking')) {
    const isOverCap = zoneName.includes('1') || zoneName.includes('4');
    return {
      name: displayName,
      type: 'standard',
      aspect: 'parking',
      diagnostic: isOverCap 
        ? `${displayName} bay capacity reached 98%. Inflow queue at gate is causing campus road congestion.`
        : `${displayName} operating at nominal 62% occupancy with automated bay reservation active.`,
      metricLabel: 'Capacity (%)',
      choices: [
        { id: '1', title: `Reroute Inflow from ${displayName}`, desc: 'Broadcasts dynamic detour notice to gate displays.', delta: '-45% Inflow', projectedData: [98, 92, 78, 62, 50] },
        { id: '2', title: 'Dynamic Surge Pricing', desc: 'Increases guest visitor tariff to dampen peak arrivals.', delta: '-15% Inflow', projectedData: [98, 95, 90, 85, 82] },
        { id: '3', title: 'Reserve Faculty Wing', desc: 'Locks bays exclusively for accredited university staff.', delta: 'Regulated', projectedData: [98, 88, 75, 70, 68] },
      ],
    };
  }

  // 4. Classroom & Lecture Hall Occupancy
  if (zoneName.includes('classroom') || zoneName.includes('lecture')) {
    return {
      name: displayName,
      type: 'standard',
      aspect: 'occupancy',
      diagnostic: `Passive IR sensors in ${displayName} read 0 occupants, yet split-AC and illumination systems are drawing 4.2 kW continuously.`,
      metricLabel: 'Power Draw (kW)',
      choices: [
        { id: '1', title: `Auto-Kill Power (${displayName})`, desc: 'Remotely trips relay to shut down lighting and AC.', delta: '-4.2 kW', projectedData: [4.2, 0.4, 0, 0, 0] },
        { id: '2', title: 'Eco-Mode Standby', desc: 'Dims lighting to 20% and sets thermostat to 26°C.', delta: '-2.8 kW', projectedData: [4.2, 2.4, 1.6, 1.4, 1.4] },
        { id: '3', title: 'Ping Scheduled Faculty', desc: 'Sends SMS to scheduled instructor before cutting power.', delta: 'Pending Ping', projectedData: [4.2, 4.2, 4.0, 4.0, 3.8] },
      ],
    };
  }

  // 5. Smart Irrigation & Garden Watering (Dynamic for ANY garden, lawn, or irrigation)
  if (zoneName.includes('garden') || zoneName.includes('lawn') || zoneName.includes('irrigation')) {
    return {
      name: displayName,
      type: 'low',
      aspect: 'irrigation',
      diagnostic: `Soil hygrometer probe in ${displayName} reads 13.8% volumetric moisture (critically dry). Meteorological feed predicts 0mm rain for 48 hours.`,
      metricLabel: 'Moisture (%)',
      choices: [
        { id: '1', title: `Trigger Sprinklers (${displayName})`, desc: `Activates rotary sprinkler zones in ${displayName} for 20 minutes.`, delta: '+60% Moisture', projectedData: [14, 48, 76, 72, 70] },
        { id: '2', title: 'Precision Drip Irrigation', desc: `Activates subsurface drip lines in ${displayName} for low-evaporation hydration.`, delta: '+35% Moisture', projectedData: [14, 30, 48, 52, 54] },
        { id: '3', title: 'Delay Until Dusk', desc: `Defers cycle to 19:30 to maximize absorption and reduce solar loss.`, delta: '0% (Scheduled)', projectedData: [14, 13, 12, 65, 68] },
      ],
    };
  }

  // 6. Energy Consumption & HVAC (fallback)
  return {
    name: displayName,
    type: 'standard',
    aspect: 'energy',
    diagnostic: `HVAC distribution at ${displayName} is overconsuming by 34% against 24-hour historical baseline. Thermal anomaly detected in primary AHU.`,
    metricLabel: 'Energy (kW/h)',
    choices: [
      { id: '1', title: 'Aggressive AHU Shutdown', desc: `Powers down secondary air-handlers in ${displayName}.`, delta: '-38% Draw', projectedData: [75, 55, 42, 35, 34] },
      { id: '2', title: 'Moderate Temperature Setback', desc: 'Increases cooling setpoint by +2.5°C across all floors.', delta: '-18% Draw', projectedData: [75, 68, 62, 52, 48] },
      { id: '3', title: 'Maintain Baseline Schedule', desc: 'Sustains current chilled-water circulation schedule.', delta: '0% Delta', projectedData: [75, 75, 70, 60, 55] },
    ],
  };
};

export default function Drawer({ isOpen, onClose, zoneId }: DrawerProps) {
  const { theme } = useTheme();
  const { telemetry } = useCampusStore();
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [selectedChoice, setSelectedChoice] = useState<number>(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const data = zoneId ? getMockData(zoneId) : null;

  // Match active zone telemetry from live CampusStoreContext
  const activeZoneTelemetry = useMemo(() => {
    if (!zoneId) return null;
    const zid = zoneId.toLowerCase();
    if (telemetry[zoneId]) return telemetry[zoneId];
    if (telemetry[zid]) return telemetry[zid];
    for (const [k, v] of Object.entries(telemetry)) {
      if (k.toLowerCase() === zid || (v && v.name && v.name.toLowerCase() === zid)) {
        return v;
      }
    }
    const cleanZid = zid.replace(/[^a-z0-9]/g, '');
    for (const [k, v] of Object.entries(telemetry)) {
      const cleanK = k.replace(/[^a-z0-9]/g, '');
      const cleanName = (v?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK && cleanZid && (cleanK.includes(cleanZid) || cleanZid.includes(cleanK) || cleanName.includes(cleanZid) || cleanZid.includes(cleanName))) {
        return v;
      }
    }
    return null;
  }, [telemetry, zoneId]);

  // Reset selection when a new zone opens
  useEffect(() => {
    setSelectedChoice(0);
  }, [zoneId]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const isEmergency = data?.type === 'emergency';
  const isParking = data?.aspect === 'parking';
  const activeChoice = data?.choices?.[selectedChoice];
  const AspectIcon = data ? (aspectIcons[data.aspect] || Activity) : Activity;

  // Detect whether YOLOv8 vision telemetry is streaming for this zone
  const hasVision = Boolean(
    activeZoneTelemetry?.vision_feed_active ||
    activeZoneTelemetry?.occupied_spots !== undefined ||
    (activeZoneTelemetry?.detection_confidence !== undefined && activeZoneTelemetry.detection_confidence > 0) ||
    (zoneId && (zoneId.toLowerCase().includes('lecture_hall_1') || zoneId.toLowerCase().includes('hall 1') || zoneId.toLowerCase().includes('parking_1')))
  );

  const visionOccupied = activeZoneTelemetry?.occupied_spots ?? (activeZoneTelemetry?.occupancy !== undefined ? activeZoneTelemetry.occupancy : undefined);
  const visionCapacity = activeZoneTelemetry?.total_capacity ?? (isParking ? 50 : (data?.aspect === 'occupancy' ? 60 : undefined));
  const visionConfidence = activeZoneTelemetry?.detection_confidence 
    ? (activeZoneTelemetry.detection_confidence * 100).toFixed(0) 
    : '94';

  // Recharts line chart data
  const chartData = activeChoice?.projectedData?.map((val, i) => ({
    time: `T+${i * 15}m`,
    value: val,
  })) || [];

  // Parking pie chart breakdown
  const parkingBreakdown = useMemo(() => {
    return data ? getParkingBreakdown(data.name) : [];
  }, [data]);

  const totalParkingSpots = useMemo(() => {
    return parkingBreakdown.reduce((sum, item) => sum + item.value, 0);
  }, [parkingBreakdown]);

  const handleExecute = () => {
    if (!activeChoice || !data) return;
    alert(`Executing: ${activeChoice.title} for ${data.name}`);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && data && (
        <motion.div
          key="drawer-viewport-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/30 backdrop-blur-sm"
        >
          {/* Centered Floating Card */}
          <motion.div
            key="drawer-center-card"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[80vh] flex flex-col border backdrop-blur-2xl rounded-3xl shadow-2xl p-6 overflow-hidden transition-colors duration-300"
            style={{
              backgroundColor: theme.panelBg,
              borderColor: theme.borderColor,
              boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 25px ${theme.glowColor}`,
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">{data.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span 
                    className={`w-2 h-2 rounded-full animate-pulse ${isEmergency ? 'bg-red-500' : ''}`}
                    style={{ backgroundColor: !isEmergency ? theme.accent : undefined }}
                  />
                  <AspectIcon 
                    size={13} 
                    className={isEmergency ? 'text-red-400' : ''}
                    style={{ color: !isEmergency ? theme.accent : undefined }}
                  />
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{data.aspect} System</span>
                </div>
              </div>
              <button 
                onClick={onClose} 
                aria-label="Close Diagnostic Modal"
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-300 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* YOLOv8 Vision AI Active Telemetry Badge */}
            {hasVision && (
              <div className="mb-4 -mt-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs font-mono text-emerald-400 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold">🟢 YOLOv8 Vision Active</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  {visionOccupied !== undefined && (
                    <span>
                      Occupancy: <strong className="text-white">{visionOccupied}{visionCapacity ? `/${visionCapacity}` : ''}</strong>
                    </span>
                  )}
                  <span className="text-emerald-400/80">• {visionConfidence}% Conf</span>
                </div>
              </div>
            )}

            {/* Live OpenCV / YOLOv8 MJPEG Video Stream */}
            {hasVision && (
              <div className="mb-4 rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-950/90 shadow-xl relative shrink-0">
                <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold tracking-wider">LIVE CCTV • CAM-01 (YOLOv8s)</span>
                </div>
                <img
                  src={`${API_BASE_URL}/api/v1/vision/feed/${encodeURIComponent(zoneId || 'soe_lecture_hall_1')}`}
                  alt="Live CCTV Camera Feed"
                  className="w-full h-44 object-cover bg-slate-900"
                />
              </div>
            )}

            {/* Inner Content Area with Smooth Scrolling */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
              {/* Diagnostic Card */}
              <div className={`p-3.5 rounded-xl border shrink-0 ${isEmergency ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/60 border-white/10'}`}>
                <div className="flex gap-3">
                  {isEmergency ? (
                    <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                  ) : (
                    <Activity className="text-cyan-400 shrink-0 mt-0.5" size={16} />
                  )}
                  <p className="text-xs text-slate-300 leading-relaxed">{data.diagnostic}</p>
                </div>
              </div>

              {/* Emergency View */}
              {isEmergency && (
                <div className="flex flex-col justify-center items-center text-center p-6 bg-red-950/20 border border-red-500/20 rounded-xl space-y-4 my-auto">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 animate-pulse">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-red-400">
                      Automated Containment Engaged
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Autonomous safety protocols are maintaining critical circuits. Manual override requires security clearance.
                    </p>
                  </div>
                  <div className="w-full bg-red-950/40 border border-red-500/30 rounded-lg p-2 text-[10px] font-mono text-red-300">
                    STATUS: EMERGENCY CREW NOTIFIED
                  </div>
                </div>
              )}

              {/* Non-Emergency Flow */}
              {!isEmergency && (
                <>
                  {/* 1. VISUALIZATION SECTION: Recharts PieChart (Parking) OR LineChart (Other aspects) */}
                  <div>
                    <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-400 mb-2.5">
                      {isParking ? 'Vehicle Capacity Breakdown' : 'Predictive Trend Forecasting'}
                    </h3>

                    {isParking ? (
                      /* Recharts PieChart for Parking Aspect */
                      <div className="h-52 w-full bg-slate-900/40 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center shrink-0">
                        {isMounted && (
                          <div className="w-full h-36 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={parkingBreakdown}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={36}
                                  outerRadius={56}
                                  paddingAngle={4}
                                  dataKey="value"
                                >
                                  {parkingBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: '#fff',
                                  }}
                                  formatter={(value: any, name: any) => [`${value} Bays`, name]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        {/* Styled Legend */}
                        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-mono mt-1">
                          {parkingBreakdown.map((item) => (
                            <div key={item.name} className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-slate-400">{item.name}:</span>
                              <span className="text-slate-200 font-bold">{item.value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          Total Capacity: {totalParkingSpots} Bays
                        </div>
                      </div>
                    ) : (
                      /* Recharts LineChart for Other Aspects */
                      <div className="h-44 w-full bg-slate-900/40 rounded-xl p-3 border border-white/5 flex flex-col shrink-0">
                        {isMounted && (
                          <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: `1px solid ${theme.borderColor}`,
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: '#fff',
                                  }}
                                  itemStyle={{ color: theme.accent }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke={theme.chartStroke}
                                  strokeWidth={2.5}
                                  dot={{ r: 3, fill: '#0f172a', stroke: theme.chartStroke, strokeWidth: 2 }}
                                  activeDot={{ r: 5, fill: theme.chartStroke }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        <div className="text-center text-[10px] text-slate-500 font-mono mt-1 shrink-0">
                          {data.metricLabel} Projection (Next 60m)
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. RESPONSE PROTOCOLS LIST */}
                  <div>
                    <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-400 mb-2.5">
                      Action Protocols
                    </h3>
                    <div className="space-y-2">
                      {data.choices.map((choice, idx) => {
                        const isSelected = selectedChoice === idx;
                        return (
                          <button
                            key={choice.id}
                            onClick={() => setSelectedChoice(idx)}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${
                              isSelected 
                                ? 'shadow-md' 
                                : 'bg-slate-900/40 border-white/5 hover:bg-slate-900/80 hover:border-white/10'
                            }`}
                            style={{
                              backgroundColor: isSelected ? theme.activeBg : undefined,
                              borderColor: isSelected ? theme.activeBorder : undefined,
                            }}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span 
                                className="font-semibold text-xs text-slate-200"
                                style={{ color: isSelected ? theme.textAccent : undefined }}
                              >
                                {choice.title}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                  isSelected
                                    ? ''
                                    : 'bg-white/5 text-slate-400 border-white/5'
                                }`}
                                style={{
                                  backgroundColor: isSelected ? theme.activeBg : undefined,
                                  borderColor: isSelected ? theme.activeBorder : undefined,
                                  color: isSelected ? theme.textAccent : undefined,
                                }}
                              >
                                {choice.delta}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{choice.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Strategy Execution Trigger */}
                  {activeChoice && (
                    <button
                      onClick={handleExecute}
                      className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-xs tracking-wide uppercase transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: theme.accent,
                        color: theme.id === 'monochrome-stealth' ? '#000000' : '#ffffff',
                        boxShadow: `0 10px 25px ${theme.glowColor}`,
                      }}
                    >
                      <Zap size={14} className="fill-current" />
                      <span>Execute Protocol ({activeChoice.title})</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}