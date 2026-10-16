"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ForecastChartProps {
  activeChoiceData: number[];
}

export function ForecastChart({ activeChoiceData }: ForecastChartProps) {
  const formattedData = [
    { time: '12:00', baseline: 75, projected: activeChoiceData?.[0] ?? 75 },
    { time: '13:00', baseline: 75, projected: activeChoiceData?.[1] ?? 75 },
    { time: '14:00', baseline: 70, projected: activeChoiceData?.[2] ?? 70 },
    { time: '15:00', baseline: 60, projected: activeChoiceData?.[3] ?? 60 },
    { time: '16:00', baseline: 55, projected: activeChoiceData?.[4] ?? 55 },
  ];

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData}>
          <XAxis dataKey="time" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip contentStyle={{ backgroundColor: '#0f172a' }} />
          <Line type="monotone" dataKey="baseline" stroke="#ef4444" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="projected" stroke="#10b981" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}