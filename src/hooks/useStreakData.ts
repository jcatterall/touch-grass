import { useEffect, useState } from 'react';
import { Tracking } from '../tracking/Tracking';

interface StreakData {
  current: number;
  longest: number;
  isTodayComplete: boolean;
}

export function useStreakData(refreshKey?: number): StreakData | null {
  const [data, setData] = useState<StreakData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      Tracking.getMetricsSummary('alltime'),
      Tracking.getMetricsSeries('week'),
    ])
      .then(([summary, series]) => {
        if (cancelled) return;
        const today = new Date().toISOString().slice(0, 10);
        setData({
          current: summary.currentGoalStreakDays,
          longest: summary.longestGoalStreakDays,
          isTodayComplete:
            series.points.find(p => p.date === today)?.streakState === 'hit',
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return data;
}
