'use client';

/**
 * components/DemoControls.tsx — DSU Smart Campus Digital Twin
 *
 * Glassmorphism floating remote control panel (bottom-right corner, fixed z-50).
 * Fires POST requests (no body) to trigger backend demo scenarios or reset all.
 * Handles SMS dispatch alerts when sms_dispatch.status === "sent".
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplets, Snowflake, AlertTriangle, Zap, Car, RotateCcw, 
  FlaskConical, ChevronDown, ChevronUp, Loader2, MessageSquare, Radio
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../utils/config';

interface ScenarioAction {
  id: string;
  endpoint: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  description: string;
}

const SCENARIOS: ScenarioAction[] = [
  {
    id: 'water_leak',
    endpoint: `${API_BASE_URL}/api/trigger/water_leak`,
    label: 'Water Leak',
    icon: Droplets,
    accentColor: '#38bdf8',
    description: 'Triggers pipe rupture & critical line pressure drop',
  },
  {
    id: 'cooling_failure',
    endpoint: `${API_BASE_URL}/api/trigger/cooling_failure`,
    label: 'Cooling Failure',
    icon: Snowflake,
    accentColor: '#a78bfa',
    description: 'Simulates AHU chiller fault in academic wings',
  },
  {
    id: 'hazardous_spill',
    endpoint: `${API_BASE_URL}/api/trigger/hazardous_spill`,
    label: 'Hazardous Spill',
    icon: AlertTriangle,
    accentColor: '#f43f5e',
    description: 'Triggers critical emergency isolation in lab zone',
  },
  {
    id: 'energy_waste',
    endpoint: `${API_BASE_URL}/api/trigger/energy_waste`,
    label: 'Energy Waste',
    icon: Zap,
    accentColor: '#fbbf24',
    description: 'Spikes unoccupied classroom lighting & AC load',
  },
  {
    id: 'parking_congestion',
    endpoint: `${API_BASE_URL}/api/trigger/parking_congestion`,
    label: 'Parking Congestion',
    icon: Car,
    accentColor: '#3b82f6',
    description: 'Simulates bay overflow & gate queue backpressure',
  },
];

export default function DemoControls() {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [smsMessage, setSmsMessage] = useState<string | null>(null);

  const executeTrigger = useCallback(
    async (scenarioId: string, endpoint: string) => {
      if (loadingId) return;
      setLoadingId(scenarioId);
      setStatusMessage(null);

      try {
        let res = await fetch(endpoint, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        // Fallback for legacy /api/trigger_demo if /api/trigger returns 404
        if (res.status === 404) {
          const fallbackUrl = scenarioId === 'reset'
            ? `${API_BASE_URL}/api/trigger_demo?scenario=OFF`
            : `${API_BASE_URL}/api/trigger_demo?scenario=${scenarioId}`;
          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          });
          if (fallbackRes.ok) {
            res = fallbackRes;
          }
        }

        const data = await res.json().catch(() => null);

        if (res.ok) {
          if (scenarioId === 'reset') {
            setActiveScenario(null);
            setStatusMessage('✓ All scenarios reset — nominal campus state restored');
          } else {
            setActiveScenario(scenarioId);
            const found = SCENARIOS.find((s) => s.id === scenarioId);
            setStatusMessage(`✓ ${found ? found.label : scenarioId} activated`);
          }

          // Automated SMS Alert Handling matching exact prompt instruction
          if (data && data.sms_dispatch && data.sms_dispatch.status === 'sent') {
            const smsNote = 'Automated SMS Alert Dispatched!';
            setSmsMessage(smsNote);
            if (typeof window !== 'undefined') {
              alert(smsNote);
            }
          }
        } else {
          setStatusMessage(`⚠ Backend returned status ${res.status}`);
        }
      } catch {
        setStatusMessage('⚠ Could not reach backend server at ' + API_BASE_URL);
      } finally {
        setLoadingId(null);
        setTimeout(() => {
          setStatusMessage(null);
          setSmsMessage(null);
        }, 5000);
      }
    },
    [loadingId]
  );

  return (
    <div
      className="fixed bottom-6 right-4 z-50 flex flex-col items-end gap-2 font-sans"
      style={{ maxWidth: '290px' }}
    >
      {/* Automated SMS Alert Banner */}
      <AnimatePresence>
        {smsMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl border bg-rose-500/20 border-rose-500/50 text-rose-300 backdrop-blur-xl shadow-xl flex items-center gap-2"
          >
            <MessageSquare size={14} className="animate-pulse text-rose-400 shrink-0" />
            <span>{smsMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Toast */}
      <AnimatePresence>
        {statusMessage && !smsMessage && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full text-[11px] font-mono px-3.5 py-2 rounded-xl border bg-slate-950/95 text-slate-200 backdrop-blur-xl shadow-lg"
            style={{ borderColor: theme.borderColor }}
          >
            {statusMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Glassmorphism Panel */}
      <div
        className="w-full rounded-2xl border backdrop-blur-2xl shadow-2xl overflow-hidden transition-colors duration-300"
        style={{
          backgroundColor: theme.panelBg,
          borderColor: theme.borderColor,
          boxShadow: `0 20px 40px rgba(0,0,0,0.7), 0 0 25px ${theme.glowColor}`,
        }}
      >
        {/* Header with expand/collapse */}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${theme.accent}20`, border: `1px solid ${theme.accent}30` }}
            >
              <FlaskConical size={14} style={{ color: theme.accent }} />
            </div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-200">
              Demo Remote
            </span>
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{
                backgroundColor: `${theme.accent}15`,
                color: theme.accent,
                border: `1px solid ${theme.accent}30`,
              }}
            >
              <Radio size={9} className="animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="text-slate-400">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </button>

        {/* Collapsible Body */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div
                className="px-3 pb-3 pt-1 space-y-1.5 border-t"
                style={{ borderColor: theme.borderColor }}
              >
                <p className="text-[10px] font-mono text-slate-400 px-1 pt-1 leading-tight">
                  Mutates FastAPI state and triggers real-time WebSocket anomaly updates.
                </p>

                {/* Scenario Buttons */}
                {SCENARIOS.map((scenario) => {
                  const Icon = scenario.icon;
                  const isActive = activeScenario === scenario.id;
                  const isLoading = loadingId === scenario.id;

                  return (
                    <button
                      key={scenario.id}
                      onClick={() => executeTrigger(scenario.id, scenario.endpoint)}
                      disabled={loadingId !== null}
                      title={scenario.description}
                      style={{
                        backgroundColor: isActive ? `${scenario.accentColor}18` : undefined,
                        borderColor: isActive ? `${scenario.accentColor}55` : theme.borderColor,
                        opacity: loadingId !== null && !isLoading ? 0.6 : 1,
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-200 hover:bg-white/5 text-left disabled:cursor-not-allowed group cursor-pointer"
                    >
                      <div
                        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: `${scenario.accentColor}20`,
                          border: `1px solid ${scenario.accentColor}30`,
                        }}
                      >
                        {isLoading ? (
                          <Loader2 size={12} className="animate-spin" style={{ color: scenario.accentColor }} />
                        ) : (
                          <Icon size={12} style={{ color: scenario.accentColor }} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs font-bold truncate"
                          style={{ color: isActive ? scenario.accentColor : '#f1f5f9' }}
                        >
                          {scenario.label}
                        </div>
                      </div>

                      {isActive && (
                        <span
                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1"
                          style={{
                            backgroundColor: `${scenario.accentColor}20`,
                            color: scenario.accentColor,
                            border: `1px solid ${scenario.accentColor}40`,
                          }}
                        >
                          <span
                            className="w-1 h-1 rounded-full animate-ping"
                            style={{ backgroundColor: scenario.accentColor }}
                          />
                          ACTIVE
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Reset All Scenarios Button */}
                <div className="pt-1.5 border-t" style={{ borderColor: theme.borderColor }}>
                  <button
                    onClick={() => executeTrigger('reset', `${API_BASE_URL}/api/reset`)}
                    disabled={loadingId !== null}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-slate-300 hover:text-white text-xs font-mono font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loadingId === 'reset' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RotateCcw size={13} />
                    )}
                    <span>Reset All</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
