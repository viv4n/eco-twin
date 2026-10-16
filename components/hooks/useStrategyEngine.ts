import { useState } from 'react';

export function useStrategyEngine() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeStrategy = async (zoneId: string, selectedChoice: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:8000/api/generate_strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_id: zoneId, choice_id: selectedChoice.id, mode: "manual" }),
      });
      if (!response.ok) throw new Error("Failed to dispatch strategy");
      return await response.json();
    } catch (err: any) {
      setError(err.message || "Fallback baseline protocol engaged.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const autoEngageEmergency = async (zoneId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:8000/api/generate_strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_id: zoneId, choice_id: 1, mode: "auto_emergency_override" }),
      });
      if (!response.ok) throw new Error("Emergency auto-engage failed");
      return await response.json();
    } catch (err: any) {
      setError("Emergency fallback protocol engaged.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { executeStrategy, autoEngageEmergency, loading, error };
}
