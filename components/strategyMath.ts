// components/strategyMath.ts

export interface ChartDataPoint {
  time: string;
  baseline: number;
  projected: number;
}

// Generates the 24-hour baseline vs projected curve based on the selected choice data
export const getForecastData = (projectedValues: number[]): ChartDataPoint[] => {
  const times = ['12:00', '13:00', '14:00', '15:00', '16:00'];
  const baselineValues = [75, 75, 70, 60, 55];

  return times.map((time, index) => ({
    time,
    baseline: baselineValues[index],
    projected: projectedValues[index] ?? baselineValues[index],
  }));
};