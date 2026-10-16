'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, Droplets, Zap, Car, Users, Leaf, AlertTriangle, 
  MapPin, Coffee, Trophy, Home, CornerDownLeft, ArrowUpDown 
} from 'lucide-react';
import { campusZones, CampusZone } from '../campusConfig';
import { useTheme } from '../context/ThemeContext';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectZone: (zone: CampusZone) => void;
}

interface AspectMeta {
  aspect: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  pillBg: string;
  pillBorder: string;
}

// Map each zone to its primary campus aspect, icon, and colors
const getZoneAspectMeta = (zone: CampusZone): AspectMeta => {
  const nameLower = zone.name.toLowerCase();
  const idLower = zone.id.toLowerCase();

  // 1. Critical Emergencies
  if (nameLower.includes('hospital') || idLower.includes('hospital') || nameLower.includes('health') || idLower.includes('health_sciences')) {
    return {
      aspect: 'emergency',
      label: 'Emergency Zone',
      icon: AlertTriangle,
      accentColor: '#f43f5e',
      pillBg: 'bg-rose-500/10',
      pillBorder: 'border-rose-500/20 text-rose-400',
    };
  }

  // 2. Water Utilities & Pipes
  if (zone.category === 'pipe_sensor' || zone.category === 'utility' || nameLower.includes('water') || idLower.includes('water') || idLower.includes('pipe')) {
    return {
      aspect: 'water',
      label: 'Water Utility',
      icon: Droplets,
      accentColor: '#38bdf8',
      pillBg: 'bg-sky-500/10',
      pillBorder: 'border-sky-500/20 text-sky-400',
    };
  }

  // 3. Parking Lots
  if (zone.category === 'parking' || nameLower.includes('parking') || idLower.includes('parking')) {
    return {
      aspect: 'parking',
      label: 'Parking Bay',
      icon: Car,
      accentColor: '#3b82f6',
      pillBg: 'bg-blue-500/10',
      pillBorder: 'border-blue-500/20 text-blue-400',
    };
  }

  // 4. Classrooms & Lecture Halls
  if (zone.category === 'classroom' || zone.category === 'lecture_hall' || nameLower.includes('class') || nameLower.includes('lecture')) {
    return {
      aspect: 'occupancy',
      label: zone.category === 'lecture_hall' ? 'Lecture Hall' : 'Classroom',
      icon: Users,
      accentColor: '#a855f7',
      pillBg: 'bg-purple-500/10',
      pillBorder: 'border-purple-500/20 text-purple-400',
    };
  }

  // 5. Smart Irrigation & Gardens
  if (zone.category === 'garden' || nameLower.includes('garden') || idLower.includes('garden')) {
    return {
      aspect: 'irrigation',
      label: 'Garden Zone',
      icon: Leaf,
      accentColor: '#10b981',
      pillBg: 'bg-emerald-500/10',
      pillBorder: 'border-emerald-500/20 text-emerald-400',
    };
  }

  // 6. Cafeterias
  if (zone.category === 'cafeteria' || nameLower.includes('cafe') || idLower.includes('cafe')) {
    return {
      aspect: 'cafeteria',
      label: 'Cafeteria',
      icon: Coffee,
      accentColor: '#f97316',
      pillBg: 'bg-orange-500/10',
      pillBorder: 'border-orange-500/20 text-orange-400',
    };
  }

  // 7. Sports & Arenas
  if (zone.category === 'sports' || nameLower.includes('stadium') || idLower.includes('stadium')) {
    return {
      aspect: 'sports',
      label: 'Sports Complex',
      icon: Trophy,
      accentColor: '#14b8a6',
      pillBg: 'bg-teal-500/10',
      pillBorder: 'border-teal-500/20 text-teal-400',
    };
  }

  // 8. Hostels & Living
  if (zone.category === 'hostel' || nameLower.includes('hostel') || idLower.includes('hostel')) {
    return {
      aspect: 'hostel',
      label: 'Campus Residence',
      icon: Home,
      accentColor: '#6366f1',
      pillBg: 'bg-indigo-500/10',
      pillBorder: 'border-indigo-500/20 text-indigo-400',
    };
  }

  // 9. Primary Academic Buildings & Energy
  return {
    aspect: 'energy',
    label: 'Campus Facility',
    icon: Zap,
    accentColor: '#f59e0b',
    pillBg: 'bg-amber-500/10',
    pillBorder: 'border-amber-500/20 text-amber-400',
  };
};

// Known active anomalies across campus
const ACTIVE_ANOMALY_ZONES = [
  'Pipe Junction W-3',
  'Classroom B4',
  'Classroom 4',
  'SOE Center',
  'Parking 1',
  'Garden Zone 3',
  'Hospital',
];

export default function SearchModal({ isOpen, onClose, onSelectZone }: SearchModalProps) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Focus input automatically when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Real-time filtering across ID, Name, Category and Aspect keywords
  const filteredZones = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Prioritize active anomalies and landmark buildings when query is empty
      const priorityList = campusZones.filter(
        (z) => ACTIVE_ANOMALY_ZONES.includes(z.name) || ACTIVE_ANOMALY_ZONES.includes(z.id)
      );
      const landmarkList = campusZones.filter(
        (z) => z.category === 'building' && !priorityList.some((p) => p.id === z.id)
      );
      const others = campusZones.filter(
        (z) => !priorityList.some((p) => p.id === z.id) && !landmarkList.some((l) => l.id === z.id)
      );
      return [...priorityList, ...landmarkList, ...others];
    }

    // Aspect keyword synonyms map
    const aspectSynonyms: Record<string, string[]> = {
      water: ['pipe', 'leak', 'water', 'valve', 'flow', 'drain', 'sensor', 'utility'],
      energy: ['power', 'hvac', 'electric', 'energy', 'consumption', 'building', 'amp', 'center'],
      parking: ['parking', 'car', 'vehicle', 'slot', 'lot', 'bay', 'ev'],
      occupancy: ['class', 'classroom', 'lecture', 'student', 'hall', 'room', 'auditorium'],
      irrigation: ['garden', 'lawn', 'irrigation', 'water', 'sprinkler', 'green', 'flora'],
      emergency: ['hospital', 'emergency', 'medical', 'clinic', 'urgent', 'critical', 'danger'],
    };

    return campusZones.filter((zone) => {
      const nameMatch = zone.name.toLowerCase().includes(q);
      const idMatch = zone.id.toLowerCase().includes(q);
      const categoryMatch = zone.category.toLowerCase().includes(q);

      // Check if query matches aspect keywords
      const matchesAspectSynonyms = Object.entries(aspectSynonyms).some(([aspectKey, keywords]) => {
        if (q.includes(aspectKey) || keywords.some((k) => q.includes(k))) {
          if (aspectKey === 'water' && (zone.category === 'pipe_sensor' || zone.category === 'utility')) return true;
          if (aspectKey === 'energy' && zone.category === 'building') return true;
          if (aspectKey === 'parking' && zone.category === 'parking') return true;
          if (aspectKey === 'occupancy' && (zone.category === 'classroom' || zone.category === 'lecture_hall')) return true;
          if (aspectKey === 'irrigation' && zone.category === 'garden') return true;
          if (aspectKey === 'emergency' && (zone.id.includes('hospital') || zone.name.includes('Hospital'))) return true;
        }
        return false;
      });

      return nameMatch || idMatch || categoryMatch || matchesAspectSynonyms;
    });
  }, [query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredZones.length]);

  // Ensure active keyboard index stays visible inside the scroll view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredZones.length > 0 ? (prev + 1) % filteredZones.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredZones.length > 0 ? (prev - 1 + filteredZones.length) % filteredZones.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredZones[selectedIndex]) {
          onSelectZone(filteredZones[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filteredZones, selectedIndex, onSelectZone, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 font-sans"
          onKeyDown={handleKeyDown}
        >
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            style={{
              backgroundColor: theme.panelBg,
              borderColor: theme.borderColor,
              boxShadow: `0 25px 60px rgba(0,0,0,0.85), 0 0 35px ${theme.glowColor}`,
            }}
            className="relative z-10 w-full max-w-xl border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* 1. TOP SEARCH INPUT HEADER */}
            <div
              className="p-3.5 border-b flex items-center gap-3 shrink-0"
              style={{ borderColor: theme.borderColor }}
            >
              <Search size={18} className="text-slate-400 shrink-0" style={{ color: theme.accent }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search campus assets, zones, pipes (e.g. Water, Hospital, Parking)..."
                className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X size={15} />
                </button>
              )}
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span>ESC</span>
              </button>
            </div>

            {/* 2. RESULTS LIST VIEW */}
            <div
              ref={listRef}
              className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-white/[0.03]"
            >
              {filteredZones.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <Search size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">No campus assets found</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    No zones matching &ldquo;<span className="text-slate-300 font-mono">{query}</span>&rdquo;. Try searching for &ldquo;Water&rdquo;, &ldquo;SOE&rdquo;, or &ldquo;Parking&rdquo;.
                  </p>
                </div>
              ) : (
                filteredZones.map((zone, idx) => {
                  const meta = getZoneAspectMeta(zone);
                  const Icon = meta.icon;
                  const isSelected = selectedIndex === idx;
                  const isTriggered = ACTIVE_ANOMALY_ZONES.includes(zone.name) || ACTIVE_ANOMALY_ZONES.includes(zone.id);

                  return (
                    <div
                      key={zone.id}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      onClick={() => onSelectZone(zone)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        backgroundColor: isSelected ? theme.activeBg : undefined,
                        borderColor: isSelected ? theme.activeBorder : 'transparent',
                      }}
                      className={`group flex items-center justify-between p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'border shadow-md'
                          : 'hover:bg-white/[0.03] border-transparent'
                      }`}
                    >
                      {/* Left: Icon & Zone Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all"
                          style={{
                            backgroundColor: `${meta.accentColor}15`,
                            borderColor: `${meta.accentColor}30`,
                            boxShadow: isSelected ? `0 0 12px ${meta.accentColor}40` : undefined,
                          }}
                        >
                          <Icon size={16} style={{ color: meta.accentColor }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                              {zone.name}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${meta.pillBg} ${meta.pillBorder}`}
                            >
                              {meta.label}
                            </span>
                            {isTriggered && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                                ALERT
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-400 truncate">
                            <span className="text-slate-500">ID:</span>
                            <span className="text-slate-300">{zone.id}</span>
                            <span className="text-slate-600">•</span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <MapPin size={10} />
                              {zone.coordinates[0]?.[0].toFixed(5)}, {zone.coordinates[0]?.[1].toFixed(5)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Enter Shortcut / Action Indicator */}
                      <div className="shrink-0 pl-3">
                        {isSelected ? (
                          <div
                            className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-1 rounded-md transition-all"
                            style={{
                              backgroundColor: `${theme.accent}25`,
                              color: theme.accent,
                              border: `1px solid ${theme.accent}40`,
                            }}
                          >
                            <span>Fly To</span>
                            <CornerDownLeft size={11} />
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Select ↵
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 3. MODAL FOOTER WITH SHORTCUT HINTS */}
            <div
              className="p-3 border-t bg-slate-950/40 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0"
              style={{ borderColor: theme.borderColor }}
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <ArrowUpDown size={12} className="text-slate-500" />
                  <span>Navigate</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-slate-300 text-[10px]">
                    ↵
                  </kbd>
                  <span>Select & Fly</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-slate-300 text-[10px]">
                    ESC
                  </kbd>
                  <span>Close</span>
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                {filteredZones.length} of {campusZones.length} assets
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

