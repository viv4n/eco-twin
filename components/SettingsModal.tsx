'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sliders, Check, RotateCcw, Palette, Sparkles } from 'lucide-react';
import { useTheme, ThemeId } from '../context/ThemeContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, themeId, setTheme, resetTheme, availableThemes } = useTheme();

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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal Container */}
          <motion.div
            key="settings-card"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="relative z-50 w-full max-w-md bg-slate-950/95 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl flex flex-col font-sans"
            style={{
              borderColor: theme.borderColor,
              boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${theme.glowColor}`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2.5 rounded-2xl bg-white/5 border border-white/10"
                  style={{ color: theme.accent }}
                >
                  <Palette size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    Display & Theme Settings
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    DSU Digital Twin Command Customization
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close Settings"
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Theme Selector Section */}
            <div className="py-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Sliders size={13} style={{ color: theme.accent }} /> Visual Matrix Palettes
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Instant Preview
                </span>
              </div>

              {/* Theme Cards Grid */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {availableThemes.map((t) => {
                  const isSelected = themeId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as ThemeId)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-2.5 relative group ${
                        isSelected
                          ? 'border-white/30 shadow-lg'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15'
                      }`}
                      style={{
                        backgroundColor: isSelected ? t.cardBg : undefined,
                        borderColor: isSelected ? t.accent : undefined,
                        boxShadow: isSelected ? `0 0 20px ${t.glowColor}` : undefined,
                      }}
                    >
                      {/* Gradient Swatch Preview */}
                      <div 
                        className={`h-11 w-full rounded-xl bg-gradient-to-r ${t.swatchGradient} p-2 flex items-center justify-between border border-white/10`}
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-4 h-4 rounded-full border border-white shadow-md"
                            style={{ backgroundColor: t.accent }}
                          />
                          <span 
                            className="w-3 h-3 rounded-full border border-white/80"
                            style={{ backgroundColor: t.accentSecondary }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-white/90 uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                            {t.id}
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{t.name}</span>
                            {isSelected && (
                              <span 
                                className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border"
                                style={{
                                  backgroundColor: t.activeBg,
                                  borderColor: t.activeBorder,
                                  color: t.accent,
                                }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            {t.tagline}
                          </p>
                        </div>

                        {isSelected ? (
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border"
                            style={{
                              backgroundColor: t.accent,
                              borderColor: '#ffffff',
                              color: '#000000',
                            }}
                          >
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-white/20 shrink-0 group-hover:border-white/40" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={resetTheme}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-mono transition-colors border border-white/5"
              >
                <RotateCcw size={13} />
                <span>Reset to Default</span>
              </button>

              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-white font-semibold text-xs transition-all shadow-md active:scale-98 flex items-center gap-1.5"
                style={{
                  backgroundColor: theme.accent,
                  color: theme.id === 'monochrome-stealth' ? '#000' : '#fff',
                }}
              >
                <Sparkles size={13} />
                <span>Apply & Close</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
