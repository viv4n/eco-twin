'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type ThemeId = 'slate-midnight' | 'cyber-neon' | 'emerald-grid' | 'monochrome-stealth';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  tagline: string;
  bgBase: string;
  panelBg: string;
  cardBg: string;
  accent: string;
  accentSecondary: string;
  borderColor: string;
  activeBorder: string;
  activeBg: string;
  glowColor: string;
  textAccent: string;
  chartStroke: string;
  swatchGradient: string;
}

export const themes: Record<ThemeId, ThemeConfig> = {
  'slate-midnight': {
    id: 'slate-midnight',
    name: 'Slate Midnight',
    tagline: 'Deep navy canvas with electric cyan/sky telemetry (Default)',
    bgBase: '#020617',
    panelBg: 'rgba(2, 6, 23, 0.92)',
    cardBg: 'rgba(15, 23, 42, 0.65)',
    accent: '#38bdf8',
    accentSecondary: '#3b82f6',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    activeBorder: 'rgba(56, 189, 248, 0.45)',
    activeBg: 'rgba(56, 189, 248, 0.15)',
    glowColor: 'rgba(56, 189, 248, 0.25)',
    textAccent: '#38bdf8',
    chartStroke: '#38bdf8',
    swatchGradient: 'from-slate-950 via-slate-900 to-sky-500',
  },
  'cyber-neon': {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    tagline: 'Dark synthwave void with neon rose/magenta telemetry',
    bgBase: '#090514',
    panelBg: 'rgba(9, 5, 20, 0.94)',
    cardBg: 'rgba(25, 12, 45, 0.65)',
    accent: '#f43f5e',
    accentSecondary: '#d946ef',
    borderColor: 'rgba(244, 63, 94, 0.25)',
    activeBorder: 'rgba(244, 63, 94, 0.5)',
    activeBg: 'rgba(244, 63, 94, 0.2)',
    glowColor: 'rgba(244, 63, 94, 0.3)',
    textAccent: '#fb7185',
    chartStroke: '#f43f5e',
    swatchGradient: 'from-purple-950 via-fuchsia-950 to-rose-500',
  },
  'emerald-grid': {
    id: 'emerald-grid',
    name: 'Emerald Grid',
    tagline: 'Dark tactical bio-matrix with vibrant mint/emerald telemetry',
    bgBase: '#02120a',
    panelBg: 'rgba(2, 18, 10, 0.94)',
    cardBg: 'rgba(4, 30, 18, 0.65)',
    accent: '#10b981',
    accentSecondary: '#059669',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    activeBorder: 'rgba(16, 185, 129, 0.5)',
    activeBg: 'rgba(16, 185, 129, 0.2)',
    glowColor: 'rgba(16, 185, 129, 0.3)',
    textAccent: '#34d399',
    chartStroke: '#10b981',
    swatchGradient: 'from-emerald-950 via-teal-950 to-emerald-500',
  },
  'monochrome-stealth': {
    id: 'monochrome-stealth',
    name: 'Monochrome Stealth',
    tagline: 'Pitch-black OLED backdrop with high-contrast amber/gold telemetry',
    bgBase: '#000000',
    panelBg: 'rgba(10, 10, 10, 0.96)',
    cardBg: 'rgba(20, 20, 20, 0.85)',
    accent: '#f59e0b',
    accentSecondary: '#d97706',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    activeBorder: 'rgba(245, 158, 11, 0.5)',
    activeBg: 'rgba(245, 158, 11, 0.2)',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    textAccent: '#fbbf24',
    chartStroke: '#f59e0b',
    swatchGradient: 'from-black via-zinc-900 to-amber-500',
  },
};

interface ThemeContextType {
  theme: ThemeConfig;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  resetTheme: () => void;
  availableThemes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'dsu_digital_twin_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>('slate-midnight');
  const [isLoaded, setIsLoaded] = useState(false);

  // Apply CSS variables and attribute to document root
  const applyThemeToDOM = (t: ThemeConfig) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', t.id);
    root.style.setProperty('--theme-bg', t.bgBase);
    root.style.setProperty('--theme-panel-bg', t.panelBg);
    root.style.setProperty('--theme-card-bg', t.cardBg);
    root.style.setProperty('--theme-accent', t.accent);
    root.style.setProperty('--theme-accent-secondary', t.accentSecondary);
    root.style.setProperty('--theme-border', t.borderColor);
    root.style.setProperty('--theme-active-border', t.activeBorder);
    root.style.setProperty('--theme-active-bg', t.activeBg);
    root.style.setProperty('--theme-accent-glow', t.glowColor);
    root.style.setProperty('--theme-text-accent', t.textAccent);
    root.style.setProperty('--theme-chart-stroke', t.chartStroke);
  };

  // Safe SSR hydration: read localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (saved && themes[saved]) {
        setThemeId(saved);
        applyThemeToDOM(themes[saved]);
      } else {
        applyThemeToDOM(themes['slate-midnight']);
      }
    } catch {
      applyThemeToDOM(themes['slate-midnight']);
    }
    setIsLoaded(true);
  }, []);

  const handleSetTheme = (id: ThemeId) => {
    if (!themes[id]) return;
    setThemeId(id);
    applyThemeToDOM(themes[id]);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // Ignore storage errors in private browsing
    }
  };

  const handleResetTheme = () => {
    handleSetTheme('slate-midnight');
  };

  const currentTheme = themes[themeId] || themes['slate-midnight'];
  const availableThemes = useMemo(() => Object.values(themes), []);

  const contextValue = useMemo(() => ({
    theme: currentTheme,
    themeId,
    setTheme: handleSetTheme,
    resetTheme: handleResetTheme,
    availableThemes,
  }), [currentTheme, themeId, availableThemes]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

