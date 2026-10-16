'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, Zap, Leaf, 
  Users, Layers, Bell, FileText, Settings, Activity, CheckCircle2,
  Droplets, Car, AlertTriangle 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
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
  const [internalTab, setInternalTab] = useState('Overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const navItems: Array<{
    name: string;
    icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
    aspect?: AspectType;
    badge?: number;
    badgeColor?: string;
  }> = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Energy & HVAC', icon: Zap, aspect: 'energy', badge: 2, badgeColor: 'bg-amber-500' },
    { name: 'Water Utilities', icon: Droplets, aspect: 'water', badge: 3, badgeColor: 'bg-sky-500' },
    { name: 'Parking Lots', icon: Car, aspect: 'parking', badge: 2, badgeColor: 'bg-blue-500' },
    { name: 'Classrooms', icon: Users, aspect: 'occupancy', badge: 2, badgeColor: 'bg-violet-500' },
    { name: 'Smart Irrigation', icon: Leaf, aspect: 'irrigation', badge: 1, badgeColor: 'bg-emerald-500' },
    { name: 'Emergencies', icon: AlertTriangle, aspect: 'emergency', badge: 2, badgeColor: 'bg-rose-500' },
    { name: 'All Facilities', icon: Layers },
    { name: 'Alerts Hub', icon: Bell, badge: 7, badgeColor: 'bg-rose-500' },
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
                  {item.badge && (
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
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.accent }} /> SYSTEM ONLINE
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
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => onSelectAspect?.('energy')}
              className="flex items-center gap-2 bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-red-200 font-medium">High Temperature:</span>
              <span className="text-slate-400 text-[11px]">Lab Block - Room 302</span>
            </button>
            <button
              onClick={() => onSelectAspect?.('energy')}
              className="flex items-center gap-2 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-amber-200 font-medium">Power Anomaly:</span>
              <span className="text-slate-400 text-[11px]">Hostel Block B</span>
            </button>
            <button
              onClick={() => onSelectAspect?.('water')}
              className="hidden sm:flex items-center gap-2 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left"
            >
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-sky-200 font-medium">Pipe Pressure Drop:</span>
              <span className="text-slate-400 text-[11px]">Junction W-3</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400 shrink-0">
            <div>28°C Partly Cloudy</div>
            <div>|</div>
            <div>Mon, 26 May 2026 16:42</div>
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
              <div className="text-3xl font-extrabold text-white tracking-tight">87<span className="text-slate-500 text-lg font-normal"> /100</span></div>
              <div className="text-xs font-bold mt-0.5" style={{ color: theme.accent }}>Good • Overall campus health</div>
            </div>
            <div 
              className="w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-xs"
              style={{
                borderColor: `${theme.accent}33`,
                borderTopColor: theme.accent,
                color: theme.accent,
              }}
            >
              87%
            </div>
          </div>

          {/* Subsystem Health Metrics - Wired to Aspect Selection */}
          <div className="space-y-3">
            {[
              { name: 'Buildings', score: 92, aspect: 'emergency' as AspectType },
              { name: 'Energy', score: 76, warning: true, aspect: 'energy' as AspectType },
              { name: 'Environment', score: 89, aspect: 'irrigation' as AspectType },
              { name: 'Security', score: 85, aspect: 'occupancy' as AspectType },
              { name: 'Facilities', score: 90, aspect: 'water' as AspectType },
              { name: 'Transport', score: 78, warning: true, aspect: 'parking' as AspectType },
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

          <div className="space-y-4 text-xs">
            <div 
              onClick={() => onSelectAspect?.('energy')}
              className="flex items-start gap-3 pb-3 border-b border-white/5 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
              <div>
                <p className="text-slate-200 font-medium">High temperature in Lab Block</p>
                <span className="text-[10px] font-mono text-slate-500">16:35 • Energy Command</span>
              </div>
            </div>
            <div 
              onClick={() => onSelectAspect?.('energy')}
              className="flex items-start gap-3 pb-3 border-b border-white/5 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
              <div>
                <p className="text-slate-200 font-medium">Power anomaly in Hostel Block B</p>
                <span className="text-[10px] font-mono text-slate-500">16:28 • Energy Command</span>
              </div>
            </div>
            <div 
              onClick={() => onSelectAspect?.('water')}
              className="flex items-start gap-3 pb-3 border-b border-white/5 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
              <div>
                <p className="text-slate-200 font-medium">Water leak in Academic Block</p>
                <span className="text-[10px] font-mono text-slate-500">16:21 • Water Command</span>
              </div>
            </div>
            <div 
              onClick={() => onSelectAspect?.('irrigation')}
              className="flex items-start gap-3 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
              <div>
                <p className="text-slate-200 font-medium">All irrigation systems operational</p>
                <span className="text-[10px] font-mono text-slate-500">15:47 • Irrigation Command</span>
              </div>
            </div>
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