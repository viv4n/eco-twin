'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Zap, ChevronRight, AlertTriangle, Smartphone } from 'lucide-react';
import PredictionGraph from './PredictionGraph';

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

interface MockData {
  name: string | null;
  type: 'emergency' | 'low' | 'standard';
  diagnostic: string;
  choices: Choice[];
}

const getMockData = (id: string | null): MockData => {
  const zoneName = (id || '').toLowerCase();
  
  if (zoneName.includes('hospital') || zoneName.includes('server')) {
    return {
      name: id,
      type: 'emergency',
      diagnostic: 'Critical failure detected. Life safety protocols or severe data loss risk active. Immediate automated intervention required.',
      choices: [] 
    };
  }
  
  if (zoneName.includes('stadium') || zoneName.includes('football') || zoneName.includes('cricket')) {
    return {
      name: id,
      type: 'low',
      diagnostic: 'High floodlight energy consumption detected outside scheduled match hours.',
      choices: [
        { id: '1', title: 'Kill Floodlights', desc: 'Remotely cuts power to stadium light masts.', delta: '-100% Load', projectedData: [75, 0, 0, 0, 0] }
      ]
    };
  }

  return {
    name: id || 'Campus Zone',
    type: 'standard',
    diagnostic: 'HVAC system is overconsuming by 34% against the 24-hour baseline. Thermal anomaly detected.',
    choices: [
      { id: '1', title: 'Aggressive Shutdown', desc: 'Powers down AHU-02 & AHU-03.', delta: '-38%', projectedData: [75, 55, 42, 35, 34] },
      { id: '2', title: 'Moderate Setback', desc: 'Adjusts setpoint by +2.5°C.', delta: '-18%', projectedData: [75, 68, 62, 52, 48] },
      { id: '3', title: 'Maintain Baseline', desc: 'Maintains active schedule.', delta: '0%', projectedData: [75, 75, 70, 60, 55] },
    ]
  };
};

export default function Drawer({ isOpen, onClose, zoneId }: DrawerProps) {
  const [selectedChoice, setSelectedChoice] = useState<number>(0);
  const data = getMockData(zoneId);

  useEffect(() => { setSelectedChoice(0); }, [zoneId]);

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
                </h2>
                <p className="text-slate-400 text-xs font-mono mt-1 uppercase tracking-widest">Active Intelligence Feed</p>
              </div>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition">
                <X size={18} />
              </button>
            </div>

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
                        <Zap size={20} className={selectedChoice === index ? "text-emerald-400" : "text-slate-500"}/>
                        <span className={`text-[10px] px-2 py-1 rounded font-mono font-bold tracking-wider ${selectedChoice === index ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                          {choice.delta}
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-slate-100 mb-2 leading-tight">{choice.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{choice.desc}</p>
                    </div>
                    <div className={`h-1 w-full rounded-full mt-4 transition-colors ${selectedChoice === index ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`} />
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
              <button onClick={onClose} className="w-full bg-emerald-600/90 backdrop-blur-xl hover:bg-emerald-500 border border-emerald-400/30 text-white font-bold py-4 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.2)] transition flex items-center justify-center gap-2 text-sm uppercase tracking-widest cursor-pointer">
                Execute Strategy <ChevronRight size={18} />
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}