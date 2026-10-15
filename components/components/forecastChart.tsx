"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ForecastChartProps {
  projectedData: number[];
}

export function ForecastChart({ projectedData }: ForecastChartProps) {
  // Static baseline array representing non-intervened energy consumption
  const staticBaseline = [75, 75, 70, 60, 55];

  const formattedData = staticBaseline.map((base, idx) => ({
    time: ['12:00', '13:00', '14:00', '15:00', '16:00'][idx],
    baseline: base,
    projected: projectedData?.[idx] ?? base,
  }));

  // Energy savings calculation
  const totalBaseline = staticBaseline.reduce((a, b) => a + b, 0);
  const totalProjected = (projectedData || staticBaseline).reduce((a, b) => a + b, 0);
  const totalSavedKw = Math.max(0, totalBaseline - totalProjected);
  const percentSaved = Math.round((totalSavedKw / totalBaseline) * 100);

  return (
    <div className="w-full h-full flex flex-col justify-between p-2">
      {/* Metric Header */}
      <div className="flex justify-between items-center px-2 mb-1">
        <span className="text-xs text-slate-400 font-medium">Predicted Delta</span>
        <span className="text-xs font-bold text-emerald-400">
          -{percentSaved}% Energy ({totalSavedKw} kWh Saved)
        </span>
      </div>

      {/* Recharts Canvas */}
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} />
            <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }} />
            <Line type="monotone" dataKey="baseline" name="Baseline (kW)" stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="projected" name="Projected (kW)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}