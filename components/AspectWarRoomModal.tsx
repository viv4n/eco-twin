'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Zap, Droplets, Car, Users, Leaf, AlertTriangle, 
  Search, ShieldCheck, CheckCircle2, SlidersHorizontal, RefreshCw, Send,
  Activity, ArrowUpRight
} from 'lucide-react';
import { 
  LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip,
  PieChart, Pie, Cell 
} from 'recharts';
import { CampusZone } from '../campusConfig';
import { useTheme } from '../context/ThemeContext';

export type AspectType = 'energy' | 'water' | 'parking' | 'occupancy' | 'irrigation' | 'emergency';

interface AspectWarRoomModalProps {
  isOpen: boolean;
  aspect: AspectType | null;
  onClose: () => void;
  onSelectAspect: (aspect: AspectType) => void;
}

// Dynamically import the Leaflet Minimap with SSR disabled
const AspectMinimap = dynamic(() => import('./AspectMinimap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/80 rounded-xl text-slate-400 font-mono text-xs gap-3">
      <RefreshCw className="animate-spin text-blue-400" size={24} />
      <span>Loading Telemetry Minimap...</span>
    </div>
  ),
});

// Aspect metadata definition
const aspectConfigs: Record<
  AspectType,
  {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accentColor: string;
    borderColor: string;
    bgPill: string;
    badgeCount: number;
    triggeredZones: string[];
    defaultZone: string;
    metricLabel: string;
    defaultDiagnostic: string;
    choices: Array<{
      id: string;
      title: string;
      desc: string;
      delta: string;
      projectedData: number[];
    }>;
  }
> = {
  energy: {
    title: 'Energy Consumption & HVAC',
    subtitle: 'High-Voltage Substation & Climate Distribution',
    icon: Zap,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgPill: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    badgeCount: 2,
    triggeredZones: ['soe', 'hostel_2'],
    defaultZone: 'SOE Center',
    metricLabel: 'Power Draw (kW/h)',
    defaultDiagnostic: 'HVAC system is overconsuming by 34% against the 24-hour baseline. Thermal anomaly detected in air handlers AHU-02 & AHU-03.',
    choices: [
      { id: '1', title: 'Aggressive Shutdown', desc: 'Powers down secondary AHU units.', delta: '-38% Draw', projectedData: [75, 55, 42, 35, 34] },
      { id: '2', title: 'Moderate Setback', desc: 'Adjusts ambient setpoint by +2.5°C.', delta: '-18% Draw', projectedData: [75, 68, 62, 52, 48] },
      { id: '3', title: 'Maintain Baseline', desc: 'Sustains current chilled-water schedule.', delta: '0% Delta', projectedData: [75, 75, 70, 60, 55] },
    ],
  },
  water: {
    title: 'Pipe Leaks & Water Utilities',
    subtitle: 'Hydrodynamic Pressure Grid & Acoustic Sensors',
    icon: Droplets,
    accentColor: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    bgPill: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    badgeCount: 3,
    triggeredZones: ['Pipe Junction W-3', 'water_utility'],
    defaultZone: 'Pipe Junction W-3',
    metricLabel: 'Line Pressure (PSI)',
    defaultDiagnostic: 'Rapid pressure drop detected (-73% under baseline). Acoustic spectral signature matches subsurface pipe fracture.',
    choices: [
      { id: '1', title: 'Emergency Valve Shutoff', desc: 'Closes automated gate valve at Junction W-3.', delta: '-100% Flow', projectedData: [12, 4, 0, 0, 0] },
      { id: '2', title: 'Pressure Bypass Reroute', desc: 'Diverts loop through Secondary Line W-8.', delta: '+32 PSI Net', projectedData: [12, 28, 38, 42, 45] },
      { id: '3', title: 'Dispatch Plumber Team', desc: 'Alerts facilities emergency maintenance crew.', delta: 'Auditing', projectedData: [12, 16, 22, 34, 45] },
    ],
  },
  parking: {
    title: 'Parking Availability & Traffic',
    subtitle: 'Optical Bay Sensors & Automated Inflow Gates',
    icon: Car,
    accentColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgPill: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    badgeCount: 2,
    triggeredZones: ['parking_1', 'parking_4'],
    defaultZone: 'Parking 1',
    metricLabel: 'Occupancy Rate (%)',
    defaultDiagnostic: 'Primary lot occupancy exceeded 98%. Queue latency at SOE entrance gate reaching 8.4 minutes.',
    choices: [
      { id: '1', title: 'Reroute to Lot 2', desc: 'Broadcasts dynamic detour notice to gate displays.', delta: '-45% Inflow', projectedData: [98, 92, 78, 62, 50] },
      { id: '2', title: 'Surge Pricing (Guests)', desc: 'Temporarily increases non-permit visitor tariff.', delta: '-15% Inflow', projectedData: [98, 95, 90, 85, 82] },
      { id: '3', title: 'Reserve Faculty Wing', desc: 'Locks bays exclusively for accredited staff.', delta: 'Regulated', projectedData: [98, 88, 75, 70, 68] },
    ],
  },
  occupancy: {
    title: 'Classroom & Lecture Occupancy',
    subtitle: 'Infrared Spatial Density & Lighting Automation',
    icon: Users,
    accentColor: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    bgPill: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    badgeCount: 2,
    triggeredZones: ['classroom_4', 'lecture_hall_2'],
    defaultZone: 'Classroom 4',
    metricLabel: 'Power Draw (kW)',
    defaultDiagnostic: 'Passive IR confirms zero occupants, but HVAC and illumination are drawing 4.2 kW continuously for 45 minutes.',
    choices: [
      { id: '1', title: 'Auto-Kill Power', desc: 'Cuts relay power to lighting and split-AC units.', delta: '-4.2 kW', projectedData: [4.2, 0.4, 0, 0, 0] },
      { id: '2', title: 'Eco-Mode Standby', desc: 'Dims lighting to 20% and sets AC to 26°C.', delta: '-2.8 kW', projectedData: [4.2, 2.4, 1.6, 1.4, 1.4] },
      { id: '3', title: 'Ping Scheduled Faculty', desc: 'Transmits automated inquiry via push SMS.', delta: 'Pending Ping', projectedData: [4.2, 4.2, 4.0, 4.0, 3.8] },
    ],
  },
  irrigation: {
    title: 'Smart Irrigation & Greenery',
    subtitle: 'Capacitive Soil Probes & Meteorological Telemetry',
    icon: Leaf,
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgPill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    badgeCount: 1,
    triggeredZones: ['garden_3', 'garden_7'],
    defaultZone: 'Garden Zone 3',
    metricLabel: 'Soil Moisture (%)',
    defaultDiagnostic: 'Topsoil moisture in Sector 3 dropped below critical 15% threshold. Forecast predicts zero precipitation over next 48 hours.',
    choices: [
      { id: '1', title: 'Trigger Sprinklers (15m)', desc: 'Pressurizes rotary sprinkler lines A & B.', delta: '+60% Moisture', projectedData: [14, 48, 76, 72, 70] },
      { id: '2', title: 'Precision Drip Cycle', desc: 'Initiates low-evaporation subterranean drip.', delta: '+35% Moisture', projectedData: [14, 30, 48, 52, 54] },
      { id: '3', title: 'Delay Until Dusk', desc: 'Schedules irrigation at 19:00 to reduce evaporation.', delta: 'Optimized', projectedData: [14, 13, 12, 65, 68] },
    ],
  },
  emergency: {
    title: 'Critical Emergencies & Life-Safety',
    subtitle: 'Autonomous Containment & Tier-3 Infrastructure',
    icon: AlertTriangle,
    accentColor: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    bgPill: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    badgeCount: 2,
    triggeredZones: ['hospital'],
    defaultZone: 'Hospital',
    metricLabel: 'Critical Redundancy (%)',
    defaultDiagnostic: 'Substation breaker tripped in Hospital Wing A. Emergency diesel generators running at 100% capacity rating.',
    choices: [
      { id: '1', title: 'Secondary Grid Failover', desc: 'Reroutes vital life-safety circuits to Substation B.', delta: 'Grid Restored', projectedData: [100, 75, 40, 15, 0] },
      { id: '2', title: 'Load Shedding Non-Critical', desc: 'Isolates administrative HVAC to protect ICU power.', delta: '-45% Gen Load', projectedData: [100, 85, 60, 55, 55] },
      { id: '3', title: 'Autonomous Lockdown', desc: 'Dispatches emergency units and seals hazardous labs.', delta: 'Lockdown Active', projectedData: [100, 100, 100, 100, 100] },
    ],
  },
};

// Mock historical alert records per aspect
interface AlertRecord {
  id: string;
  timestamp: string;
  zoneName: string;
  metric: string;
  severity: 'Critical' | 'Warning' | 'Nominal';
  actionTaken: string;
}

const mockAlertLogs: Record<AspectType, AlertRecord[]> = {
  energy: [
    { id: 'e-1', timestamp: '16:42:10', zoneName: 'SOE Center', metric: '74.8 kW (+34%)', severity: 'Critical', actionTaken: 'AHU Setback Pending' },
    { id: 'e-2', timestamp: '16:28:44', zoneName: 'Hostel 2 (Block B)', metric: 'Imbalance 415V', severity: 'Warning', actionTaken: 'Capacitor Bank Dispatched' },
    { id: 'e-3', timestamp: '15:12:08', zoneName: 'CDSIMER Center', metric: '48.2 kW Draw', severity: 'Nominal', actionTaken: 'Substation Switch Normal' },
    { id: 'e-4', timestamp: '14:05:19', zoneName: 'A Block', metric: '32.1 kW Draw', severity: 'Nominal', actionTaken: 'Peak Hours Baseline Check' },
    { id: 'e-5', timestamp: '11:30:00', zoneName: 'Pharmacy Block', metric: '19.4 kW (+12%)', severity: 'Warning', actionTaken: 'Thermostat Drift Logged' },
  ],
  water: [
    { id: 'w-1', timestamp: '16:44:21', zoneName: 'Pipe Junction W-3', metric: '12 PSI (-73%)', severity: 'Critical', actionTaken: 'Valve Isolation Queued' },
    { id: 'w-2', timestamp: '16:21:05', zoneName: 'Water Utility', metric: 'Flow: 142 L/m', severity: 'Warning', actionTaken: 'Flow Restrictor Engaged' },
    { id: 'w-3', timestamp: '15:40:12', zoneName: 'Pipe Junction W-7', metric: '44 PSI Normal', severity: 'Nominal', actionTaken: 'Telemetry Heartbeat OK' },
    { id: 'w-4', timestamp: '14:15:30', zoneName: 'Pipe Junction W-12', metric: 'Acoustic 82 dB', severity: 'Warning', actionTaken: 'Plumber Inspection Queued' },
    { id: 'w-5', timestamp: '12:00:15', zoneName: 'CDSIMER Supply', metric: '42 PSI Normal', severity: 'Nominal', actionTaken: 'Routine Loop Calibration' },
  ],
  parking: [
    { id: 'p-1', timestamp: '16:38:50', zoneName: 'Parking 1', metric: '98% Full (245/250)', severity: 'Critical', actionTaken: 'Gate Inflow Reroute Sent' },
    { id: 'p-2', timestamp: '16:15:22', zoneName: 'Parking 4', metric: '84% Capacity', severity: 'Warning', actionTaken: 'Overflow Guidance Active' },
    { id: 'p-3', timestamp: '15:30:10', zoneName: 'Parking 2', metric: '45% Capacity', severity: 'Nominal', actionTaken: 'Space Sensor Grid Synced' },
    { id: 'p-4', timestamp: '14:20:00', zoneName: 'Parking 3', metric: '60% Capacity', severity: 'Nominal', actionTaken: 'Barrier Gate Audit Normal' },
    { id: 'p-5', timestamp: '13:00:00', zoneName: 'Parking 5', metric: '22% Capacity', severity: 'Nominal', actionTaken: 'Off-Peak Status Recorded' },
  ],
  occupancy: [
    { id: 'o-1', timestamp: '16:40:15', zoneName: 'Classroom 4', metric: '0 Occ / 4.2 kW', severity: 'Critical', actionTaken: 'Auto-Kill Protocol Armed' },
    { id: 'o-2', timestamp: '16:18:32', zoneName: 'Lecture Hall 2', metric: '120 Occ (Max 80)', severity: 'Warning', actionTaken: 'CO2 Ventilation Overdrive' },
    { id: 'o-3', timestamp: '15:45:00', zoneName: 'Classroom 1', metric: '34 Occ / Scheduled', severity: 'Nominal', actionTaken: 'RFID Attendance Logged' },
    { id: 'o-4', timestamp: '14:10:20', zoneName: 'Lecture Hall 1', metric: '0 Occ / Sleep Mode', severity: 'Nominal', actionTaken: 'Scheduled Sleep Active' },
    { id: 'o-5', timestamp: '12:30:00', zoneName: 'Classroom 9', metric: 'Temp: 27.5°C Drift', severity: 'Warning', actionTaken: 'Thermostat SMS Transmitted' },
  ],
  irrigation: [
    { id: 'i-1', timestamp: '16:35:10', zoneName: 'Garden Zone 3', metric: 'Moisture: 14%', severity: 'Critical', actionTaken: 'Autonomous Watering Triggered' },
    { id: 'i-2', timestamp: '16:10:05', zoneName: 'Garden Zone 7', metric: 'Moisture: 18%', severity: 'Warning', actionTaken: 'Evaporation Risk Flagged' },
    { id: 'i-3', timestamp: '15:20:00', zoneName: 'Garden Zone 1', metric: 'Moisture: 48%', severity: 'Nominal', actionTaken: 'Probe Diagnostic Normal' },
    { id: 'i-4', timestamp: '14:00:00', zoneName: 'Garden Zone 12', metric: 'Moisture: 52%', severity: 'Nominal', actionTaken: 'Solenoid Pulse Verified' },
    { id: 'i-5', timestamp: '11:15:30', zoneName: 'Garden Zone 18', metric: 'Moisture: 22%', severity: 'Warning', actionTaken: 'Weather API 48h Dry Check' },
  ],
  emergency: [
    { id: 'em-1', timestamp: '16:41:00', zoneName: 'Hospital', metric: 'Generator 100% Load', severity: 'Critical', actionTaken: 'Autonomous Lockdown Active' },
    { id: 'em-2', timestamp: '16:30:15', zoneName: 'Server Central', metric: 'Temp: 32.8°C Spike', severity: 'Critical', actionTaken: 'Precision CRAC Boost' },
    { id: 'em-3', timestamp: '15:10:00', zoneName: 'CDSIMER Bay', metric: 'Medical Gas: 55 PSI', severity: 'Nominal', actionTaken: 'Loop Telemetry Verified' },
    { id: 'em-4', timestamp: '13:45:20', zoneName: 'Fire Suppression', metric: 'Pressure: 160 PSI', severity: 'Nominal', actionTaken: 'Self-Test Sequence Passed' },
    { id: 'em-5', timestamp: '10:00:00', zoneName: 'Pharmacy Storage', metric: 'Temp: -20.2°C', severity: 'Nominal', actionTaken: 'Cold Chain Verified' },
  ],
};

export default function AspectWarRoomModal({
  isOpen,
  aspect,
  onClose,
  onSelectAspect,
}: AspectWarRoomModalProps) {
  const currentAspect = aspect || 'energy';
  const config = aspectConfigs[currentAspect];
  const { theme } = useTheme();

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [selectedZoneName, setSelectedZoneName] = useState<string>(config.defaultZone);
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'All' | 'Critical' | 'Warning' | 'Nominal'>('All');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isParking = currentAspect === 'parking';

  const parkingBreakdown = useMemo(() => {
    const isHighCap = selectedZoneName.includes('1') || selectedZoneName.includes('4');
    return [
      { name: '4-Wheelers', value: isHighCap ? 140 : 80, color: '#3b82f6' },
      { name: '2-Wheelers', value: isHighCap ? 85 : 55, color: '#06b6d4' },
      { name: 'EV Charging', value: isHighCap ? 20 : 15, color: '#10b981' },
      { name: 'Available Spots', value: isHighCap ? 5 : 50, color: '#475569' },
    ];
  }, [selectedZoneName]);

  const totalParkingBays = useMemo(() => {
    return parkingBreakdown.reduce((sum, item) => sum + item.value, 0);
  }, [parkingBreakdown]);

  // Sync selected zone and choices when aspect switches
  useEffect(() => {
    setSelectedZoneName(config.defaultZone);
    setSelectedChoiceIdx(0);
    setExecutionMessage(null);
  }, [currentAspect, config.defaultZone]);

  // Handle ESC key listener to dismiss
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

  // Filter alert logs based on search query and severity
  const filteredLogs = useMemo(() => {
    const logs = mockAlertLogs[currentAspect] || [];
    return logs.filter((log) => {
      const matchesSearch = log.zoneName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.metric.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.actionTaken.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeverity = severityFilter === 'All' ? true : log.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [currentAspect, searchQuery, severityFilter]);

  const activeChoice = config.choices[selectedChoiceIdx] || config.choices[0];

  // Recharts predictive curve mapping
  const chartData = useMemo(() => {
    return activeChoice?.projectedData?.map((val, i) => ({
      time: `T+${i * 15}m`,
      projected: val,
      baseline: config.choices[config.choices.length - 1]?.projectedData[i] ?? val,
    })) || [];
  }, [activeChoice, config.choices]);

  // Handle Strategy Action Execution
  const handleExecute = () => {
    setIsExecuting(true);
    setExecutionMessage(null);

    // Simulate strategy action dispatch: POST /api/v1/actions/execute
    setTimeout(() => {
      setIsExecuting(false);
      setExecutionMessage(`Dispatched: ${activeChoice.title} for ${selectedZoneName} (Choice ID: ${activeChoice.id})`);
      setTimeout(() => setExecutionMessage(null), 5000);
    }, 800);
  };

  const IconComponent = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="war-room-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 backdrop-blur-2xl p-6 flex flex-col overflow-hidden font-sans border transition-colors duration-300"
          style={{
            backgroundColor: theme.bgBase,
            borderColor: theme.borderColor,
          }}
        >
          {/* 1. TOP HEADER WITH TELEMETRY STATUS & CLOSE BUTTON */}
          <header className="flex items-center justify-between pb-5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-slate-900 border ${config.borderColor} shadow-lg shadow-black/40`}>
                <IconComponent size={24} className={config.accentColor} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    {config.title}
                  </h1>
                  <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${config.bgPill}`}>
                    {config.badgeCount} ACTIVE ANOMALIES
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE TELEMETRY
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{config.subtitle}</p>
              </div>
            </div>

            {/* Aspect Quick Switcher Tabs */}
            <div
              style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
              className="hidden lg:flex items-center gap-1 p-1.5 rounded-2xl border"
            >
              {(['energy', 'water', 'parking', 'occupancy', 'irrigation', 'emergency'] as AspectType[]).map((asp) => {
                const cfg = aspectConfigs[asp];
                const AspIcon = cfg.icon;
                const isActive = currentAspect === asp;
                return (
                  <button
                    key={asp}
                    onClick={() => onSelectAspect(asp)}
                    style={isActive ? {
                      backgroundColor: `${theme.accent}20`,
                      borderColor: theme.accent,
                      color: '#ffffff',
                    } : {}}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isActive
                        ? 'shadow-sm'
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <AspIcon size={14} className={isActive ? cfg.accentColor : 'text-slate-500'} />
                    <span className="capitalize">{asp}</span>
                  </button>
                );
              })}
            </div>

            {/* Close Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                aria-label="Close War Room"
                style={{ borderColor: theme.borderColor }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border transition-colors text-slate-300 hover:text-white text-xs font-mono font-semibold"
              >
                <span>ESC</span>
                <X size={16} />
              </button>
            </div>
          </header>

          {/* 2. THREE-PANEL COMMAND WAR ROOM GRID */}
          <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 pt-6">
            
            {/* PANEL A: FOCUSED LEAFLET MINIMAP (4 COLUMNS) */}
            <section
              style={{ backgroundColor: theme.panelBg, borderColor: theme.borderColor }}
              className="col-span-12 xl:col-span-4 flex flex-col border rounded-2xl overflow-hidden shadow-2xl"
            >
              <div
                style={{ borderColor: theme.borderColor }}
                className="p-4 border-b flex items-center justify-between shrink-0 bg-slate-950/40"
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} className={config.accentColor} />
                  <h2 className="text-xs font-mono uppercase tracking-widest text-slate-200">
                    Panel A • Asset Topography
                  </h2>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Focus: <span className="text-white font-semibold">{selectedZoneName}</span>
                </div>
              </div>

              <div className="flex-1 w-full min-h-[300px] relative">
                <AspectMinimap
                  aspect={currentAspect}
                  selectedZoneId={selectedZoneName}
                  triggeredZoneIds={config.triggeredZones}
                  onSelectZone={(zone: CampusZone) => setSelectedZoneName(zone.name)}
                />
              </div>
            </section>

            {/* PANEL B: ALERT HISTORY & LOGS TABLE (4 COLUMNS) */}
            <section
              style={{ backgroundColor: theme.panelBg, borderColor: theme.borderColor }}
              className="col-span-12 xl:col-span-4 flex flex-col border rounded-2xl overflow-hidden shadow-2xl"
            >
              <div
                style={{ borderColor: theme.borderColor }}
                className="p-4 border-b shrink-0 bg-slate-950/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-blue-400" />
                    <h2 className="text-xs font-mono uppercase tracking-widest text-slate-200">
                      Panel B • Alert Stream & Logs
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {filteredLogs.length} Events Logged
                  </span>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                    <input
                      type="text"
                      placeholder="Search alerts or zones..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as any)}
                    className="bg-slate-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 font-mono"
                  >
                    <option value="All">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="Warning">Warning</option>
                    <option value="Nominal">Nominal</option>
                  </select>
                </div>
              </div>

              {/* Scrollable Table */}
              <div className="flex-1 overflow-y-auto overflow-x-auto divide-y divide-white/5">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950/60 sticky top-0 z-10 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/5">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Zone</th>
                      <th className="py-2.5 px-3">Reading</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Protocol Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {filteredLogs.map((log) => {
                      const isSelected = selectedZoneName === log.zoneName;
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedZoneName(log.zoneName)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-600/20 text-white'
                              : 'hover:bg-white/5 text-slate-300'
                          }`}
                        >
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="py-3 px-3 font-semibold whitespace-nowrap flex items-center gap-1.5">
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                            <span>{log.zoneName}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                            {log.metric}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                log.severity === 'Critical'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : log.severity === 'Warning'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}
                            >
                              {log.severity}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                            {log.actionTaken}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredLogs.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs font-mono">
                    No alert records match the specified query filters.
                  </div>
                )}
              </div>
            </section>

            {/* PANEL C: ACTIVE STRATEGY CONSOLE (4 COLUMNS) */}
            <section
              style={{ backgroundColor: theme.panelBg, borderColor: theme.borderColor }}
              className="col-span-12 xl:col-span-4 flex flex-col border rounded-2xl overflow-hidden shadow-2xl"
            >
              <div
                style={{ borderColor: theme.borderColor }}
                className="p-4 border-b shrink-0 bg-slate-950/40 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Zap size={16} className={config.accentColor} />
                  <h2 className="text-xs font-mono uppercase tracking-widest text-slate-200">
                    Panel C • Strategy Console
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={14} /> AUTONOMOUS READY
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                
                {/* Active Diagnostic Status Box */}
                <div
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
                  className="border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Active Entity
                    </span>
                    <span className="text-xs font-bold text-white font-mono bg-white/5 px-2 py-0.5 rounded">
                      {selectedZoneName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {config.defaultDiagnostic}
                  </p>
                </div>

                {/* Visual Telemetry Chart: Recharts PieChart (Parking) OR LineChart (Other aspects) */}
                <div
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
                  className="border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      {isParking ? 'Vehicle Capacity Breakdown' : `Predictive Curve • ${config.metricLabel}`}
                    </div>
                    {!isParking && (
                      <div className="flex items-center gap-3 text-[10px] font-mono">
                        <span className="flex items-center gap-1" style={{ color: theme.chartStroke }}>
                          <span className="w-2 h-0.5" style={{ backgroundColor: theme.chartStroke }} /> Projected
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <span className="w-2 h-0.5 bg-slate-500" /> Baseline
                        </span>
                      </div>
                    )}
                  </div>

                  {isParking ? (
                    <div className="h-48 w-full flex flex-col items-center justify-center">
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
                                  <Cell key={`modal-cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
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
                        Total Capacity: {totalParkingBays} Bays
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 w-full">
                      {isMounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#fff',
                              }}
                            />
                            <Line type="monotone" dataKey="baseline" stroke="#64748b" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="projected" stroke={theme.chartStroke} strokeWidth={2.5} dot={{ r: 3, fill: theme.chartStroke }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  )}
                </div>

                {/* Protocol Selector Options */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
                    Response Protocols
                  </h3>
                  <div className="space-y-2.5">
                    {config.choices.map((choice, idx) => {
                      const isSelected = selectedChoiceIdx === idx;
                      return (
                        <button
                          key={choice.id}
                          onClick={() => setSelectedChoiceIdx(idx)}
                          style={isSelected ? {
                            borderColor: theme.accent,
                            backgroundColor: `${theme.accent}15`,
                            boxShadow: `0 0 15px ${theme.glowColor}`
                          } : {}}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                            isSelected
                              ? ''
                              : 'bg-slate-950/50 border-white/5 hover:bg-slate-900/80 hover:border-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span
                              style={isSelected ? { color: theme.accent } : {}}
                              className={`text-xs font-bold ${isSelected ? '' : 'text-slate-200'}`}
                            >
                              {choice.title}
                            </span>
                            <span
                              style={isSelected ? { backgroundColor: `${theme.accent}25`, color: theme.accent } : {}}
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                isSelected ? '' : 'bg-white/5 text-slate-400'
                              }`}
                            >
                              {choice.delta}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {choice.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Execution Notification Banner */}
                {executionMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300 font-mono"
                  >
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>{executionMessage}</span>
                  </motion.div>
                )}

                {/* Strategy Execution Action Button */}
                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.id === 'monochrome-stealth' ? '#000000' : '#ffffff',
                    boxShadow: `0 10px 25px ${theme.glowColor}`,
                  }}
                  className="w-full py-3.5 px-4 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Transmitting Protocol Action...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Execute Strategy ({activeChoice?.title})</span>
                      <ArrowUpRight size={14} />
                    </>
                  )}
                </button>

              </div>
            </section>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
