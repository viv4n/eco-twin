// components/PredictionGraph.tsx
'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getForecastData } from './strategyMath';

interface PredictionGraphProps {
  projectedData: number[];
}

export default function PredictionGraph({ projectedData }: PredictionGraphProps) {
  const chartData = getForecastData(projectedData);

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} 
            itemStyle={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} />
          <Line type="monotone" dataKey="baseline" name="Baseline (kW)" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="projected" name="Projected (kW)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}