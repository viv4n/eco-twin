'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, Zap, Leaf, 
  Users, Layers, Bell, FileText, Settings, Activity, CheckCircle2,
  Droplets, Car, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useCampusStore } from '../context/CampusStoreContext';
import SettingsModal from './SettingsModal';

export type AspectType = 'energy' | 'water' | 'parking' | 'occupancy' | 'irrigation' | 'emergency';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeAspect?: AspectType | null;
  onSelectAspect?: (aspect: AspectType | null) => void;
}

export default function DashboardLayout({
  children,
  activeAspect = null,
  onSelectAspect,
}: DashboardLayoutProps) {
  const { theme } = useTheme();
  const { telemetry, triggeredZoneIds, isConnected } = useCampusStore();
  const [internalTab, setInternalTab] = useState('Overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState('Mon, 26 May');

  React.useEffect(() => {
    setCurrentDateStr(
      new Date().toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    );
  }, []);

  // Compute live active anomaly items from telemetry state
  const activeAlerts = React.useMemo(() => {
    const alerts: Array<{
      id: string;
      name: string;
      status: string;
      aspect: AspectType;
      label: string;
      detail: string;
    }> = [];

    Object.entries(telemetry || {}).forEach(([key, val]: [string, any]) => {
      if (!val || typeof val !== 'object') return;
      const status = (val.status || '').toLowerCase();
      if (['critical', 'warning', 'critical_waste', 'low'].includes(status) || val.leak_detected) {
        let aspect: AspectType = 'energy';
        let label = 'Power Anomaly';
        let detail = `${val.power_consumption_kw || 45} kW`;

        if (val.leak_detected || key.includes('pipe') || key.includes('water')) {
          aspect = 'water';
          label = 'Pipe Pressure Drop';
          detail = `${val.water_pressure_psi || 14} PSI`;
        } else if (key.includes('parking')) {
          aspect = 'parking';
          label = 'Parking Congestion';
          detail = `${val.occupancy_pct || 96}% Full`;
        } else if (val.temperature_c && val.temperature_c > 35) {
          aspect = 'emergency';
          label = 'Critical Temp';
          detail = `${val.temperature_c}°C`;
        } else if (val.co2_ppm && val.co2_ppm > 1000) {
          aspect = 'occupancy';
          label = 'High CO2 ppm';
          detail = `${val.co2_ppm} ppm`;
        }

        alerts.push({
          id: key,
          name: val.name || key.replace(/_/g, ' ').toUpperCase(),
          status,
          aspect,
          label,
          detail,
        });
      }
    });

    return alerts;
  }, [telemetry]);

  // Dynamic Campus Health Score
  const healthScore = Math.max(100 - (activeAlerts.length * 14), 38);

  const navItems: Array<{
    name: string;
    icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
    aspect?: AspectType;
    badge?: number;
    badgeColor?: string;
  }> = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Energy & HVAC', icon: Zap, aspect: 'energy', badge: activeAlerts.filter(a => a.aspect === 'energy').length || undefined, badgeColor: 'bg-amber-500' },
    { name: 'Water Utilities', icon: Droplets, aspect: 'water', badge: activeAlerts.filter(a => a.aspect === 'water').length || undefined, badgeColor: 'bg-sky-500' },
    { name: 'Parking Lots', icon: Car, aspect: 'parking', badge: activeAlerts.filter(a => a.aspect === 'parking').length || undefined, badgeColor: 'bg-blue-500' },
    { name: 'Classrooms', icon: Users, aspect: 'occupancy', badge: activeAlerts.filter(a => a.aspect === 'occupancy').length || undefined, badgeColor: 'bg-violet-500' },
    { name: 'Smart Irrigation', icon: Leaf, aspect: 'irrigation', badge: activeAlerts.filter(a => a.aspect === 'irrigation').length || undefined, badgeColor: 'bg-emerald-500' },
    { name: 'Emergencies', icon: AlertTriangle, aspect: 'emergency', badge: activeAlerts.filter(a => a.aspect === 'emergency').length || undefined, badgeColor: 'bg-rose-500' },
    { name: 'All Facilities', icon: Layers },
    { name: 'Alerts Hub', icon: Bell, badge: activeAlerts.length || undefined, badgeColor: 'bg-rose-500' },
    { name: 'Reports', icon: FileText },
    { name: 'Settings', icon: Settings },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.name === 'Settings') {
      setIsSettingsOpen(true);
      return;
    }
    setInternalTab(item.name);
    if (item.aspect) {
      onSelectAspect?.(item.aspect);
    } else {
      onSelectAspect?.(null);
    }
  };

  return (
    <div 
      className="w-screen h-screen text-slate-100 flex overflow-hidden font-sans transition-colors duration-300"
      style={{ backgroundColor: theme.bgBase }}
    >
      
      {/* 1. LEFT SIDEBAR: Navigation & System Menu */}
      <aside 
        className="w-64 h-full backdrop-blur-2xl border-r flex flex-col justify-between z-20 shrink-0 transition-colors duration-300"
        style={{ 
          backgroundColor: theme.panelBg,
          borderColor: theme.borderColor,
        }}
      >
        <div>
          {/* Logo / Header */}
          <div 
            onClick={() => onSelectAspect?.(null)}
            className="p-5 border-b cursor-pointer hover:bg-white/5 transition-colors"
            style={{ borderColor: theme.borderColor }}
          >
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center justify-between">
              <span>Dayananda Sagar University</span>
              <CheckCircle2 size={14} style={{ color: theme.accent }} />
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mt-0.5">
              Campus Digital Twin
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Operations & Modules
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isAspectActive = item.aspect && activeAspect === item.aspect;
              const isOverviewActive = !activeAspect && !item.aspect && internalTab === 'Overview';
              const isActive = isAspectActive || isOverviewActive;

              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive 
                      ? 'border shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  style={{
                    backgroundColor: isActive ? theme.activeBg : undefined,
                    borderColor: isActive ? theme.activeBorder : 'transparent',
                    color: isActive ? theme.textAccent : undefined,
                    boxShadow: isActive ? `0 0 15px ${theme.glowColor}` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} style={{ color: isActive ? theme.accent : undefined }} />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`${item.badgeColor || 'bg-rose-500'} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Info Box */}
        <div 
          className="p-4 border-t"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.cardBg }}
        >
          <div className="text-[11px] font-bold text-white">DSU Harohalli</div>
          <div className="text-[10px] text-slate-400">Bengaluru, Karnataka</div>
          <div className="text-[9px] font-mono mt-2 flex items-center gap-1.5" style={{ color: theme.accent }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.accent }} /> 
            {isConnected ? 'LIVE WEBSOCKET SYNC' : 'REST POLLING ACTIVE'}
          </div>
        </div>
      </aside>

      {/* 2. CENTER PANEL: Top Ticker + Map Canvas */}
      <div className="flex-1 h-full flex flex-col relative overflow-hidden">
        
        {/* Top Header Ticker Bar */}
        <header 
          className="h-16 backdrop-blur-xl border-b px-6 flex items-center justify-between z-10 shrink-0 transition-colors duration-300"
          style={{ backgroundColor: theme.panelBg, borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
            {activeAlerts.length > 0 ? (
              activeAlerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => onSelectAspect?.(alert.aspect)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left shrink-0 ${
                    alert.status === 'critical' || alert.status === 'critical_waste'
                      ? 'bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200'
                      : 'bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-amber-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${alert.status === 'critical' ? 'bg-rose-500 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
                  <span className="font-semibold">{alert.label}:</span>
                  <span className="text-slate-300 text-[11px] truncate max-w-[140px]">{alert.name}</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-black/30 border border-white/10">{alert.detail}</span>
                </button>
              ))
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono px-3 py-1.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                <span>All 36 Campus Zones Nominal • Autonomous Digital Twin Active</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400 shrink-0">
            <div>28°C Partly Cloudy</div>
            <div>|</div>
            <div>{currentDateStr}</div>
          </div>
        </header>

        {/* Main Map Container */}
        <div className="flex-1 relative w-full h-full">
          {children}
        </div>
      </div>

      {/* 3. RIGHT SIDEBAR: Campus Health & Recent Activity */}
      <aside 
        className="w-80 h-full backdrop-blur-2xl border-l flex flex-col p-5 overflow-y-auto z-20 space-y-6 shrink-0 transition-colors duration-300"
        style={{ backgroundColor: theme.panelBg, borderColor: theme.borderColor }}
      >
        
        {/* Overall Campus Health Gauge Card */}
        <div 
          className="border p-5 rounded-2xl shadow-xl transition-colors duration-300"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Activity size={14} style={{ color: theme.accent }} /> Campus Health
            </h3>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {healthScore}<span className="text-slate-500 text-lg font-normal"> /100</span>
              </div>
              <div className="text-xs font-bold mt-0.5" style={{ color: healthScore < 70 ? '#f43f5e' : theme.accent }}>
                {healthScore >= 85 ? 'Nominal • Systems optimal' : healthScore >= 65 ? 'Warning • Active anomalies' : 'Critical • Interventions required'}
              </div>
            </div>
            <div 
              className="w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-xs"
              style={{
                borderColor: `${healthScore < 70 ? '#f43f5e' : theme.accent}33`,
                borderTopColor: healthScore < 70 ? '#f43f5e' : theme.accent,
                color: healthScore < 70 ? '#f43f5e' : theme.accent,
              }}
            >
              {healthScore}%
            </div>
          </div>

          {/* Subsystem Health Metrics - Wired to Aspect Selection */}
          <div className="space-y-3">
            {[
              { name: 'Buildings', score: activeAlerts.some(a => a.aspect === 'occupancy') ? 78 : 95, aspect: 'emergency' as AspectType },
              { name: 'Energy', score: activeAlerts.some(a => a.aspect === 'energy') ? 68 : 96, warning: activeAlerts.some(a => a.aspect === 'energy'), aspect: 'energy' as AspectType },
              { name: 'Environment', score: 89, aspect: 'irrigation' as AspectType },
              { name: 'Security', score: 92, aspect: 'occupancy' as AspectType },
              { name: 'Facilities', score: activeAlerts.some(a => a.aspect === 'water') ? 54 : 94, warning: activeAlerts.some(a => a.aspect === 'water'), aspect: 'water' as AspectType },
              { name: 'Transport', score: activeAlerts.some(a => a.aspect === 'parking') ? 72 : 98, warning: activeAlerts.some(a => a.aspect === 'parking'), aspect: 'parking' as AspectType },
            ].map((sys) => (
              <div 
                key={sys.name} 
                onClick={() => onSelectAspect?.(sys.aspect)}
                className="space-y-1 cursor-pointer p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">{sys.name}</span>
                  <span className="font-mono text-slate-400">{sys.score} /100</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${sys.score}%`,
                      backgroundColor: sys.warning ? '#f59e0b' : theme.accent,
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Ticker */}
        <div 
          className="border p-5 rounded-2xl shadow-xl flex-1 transition-colors duration-300"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
        >
          <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Bell size={14} style={{ color: theme.accent }} /> Recent Activity
          </h3>

          <div className="space-y-3 text-xs">
            {activeAlerts.length > 0 ? (
              activeAlerts.slice(0, 4).map((alert) => (
                <div 
                  key={alert.id}
                  onClick={() => onSelectAspect?.(alert.aspect)}
                  className="flex items-start gap-3 pb-2.5 border-b border-white/5 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${alert.status === 'critical' ? 'bg-rose-500 animate-ping' : 'bg-amber-500'}`} />
                  <div>
                    <p className="text-slate-200 font-medium">{alert.label}: {alert.name}</p>
                    <span className="text-[10px] font-mono text-slate-400">{alert.detail} • Live Telemetry</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-xs py-3 font-mono flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>All telemetry streams nominal. No active incident logs.</span>
              </div>
            )}
          </div>
        </div>

      </aside>

      {/* Settings & Theme Customization Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

    </div>
  );
}