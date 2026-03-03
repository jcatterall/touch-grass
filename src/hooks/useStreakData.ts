import { useEffect, useState } from 'react';
import { Tracking } from '../tracking/Tracking';
import { fastStorage, metricsStorage } from '../storage';

interface StreakData {
  current: number;
  longest: number;
  isTodayComplete: boolean;
  shouldAnimateHitToday: boolean;
  completedWeekdays: string[];
}

function localYyyyMmDd(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getCurrentWeekRange(today: Date = new Date()): {
  start: string;
  end: string;
} {
  const todayLocal = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dayIndex = todayLocal.getDay();
  const daysFromMonday = dayIndex === 0 ? 6 : dayIndex - 1;

  const weekStart = new Date(todayLocal);
  weekStart.setDate(todayLocal.getDate() - daysFromMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    start: localYyyyMmDd(weekStart),
    end: localYyyyMmDd(weekEnd),
  };
}

function weekdayLabelFromLocalDateString(dateStr: string): string | null {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const localDate = new Date(year, month - 1, day);
  const dayIndex = localDate.getDay();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdays[dayIndex] ?? null;
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
        const today = localYyyyMmDd();
        const currentWeek = getCurrentWeekRange();
        const isFastStorageForToday = fastStorage.getCurrentDay() === today;
        const todaySeriesPoint = series.points.find(p => p.date === today);

        // Keep completion rendering tied to canonical local-day state.
        // MMKV provides immediate today status; metrics series confirms persisted hit.
        const isTodayComplete =
          (isFastStorageForToday && fastStorage.getGoalsReached()) ||
          todaySeriesPoint?.streakState === 'hit';

        // Determine if this is the first time the user is seeing today's hit.
        const seen = metricsStorage.getStreakHitSeen(today);
        const shouldAnimateHitToday = isTodayComplete && !seen;
        if (shouldAnimateHitToday) {
          metricsStorage.setStreakHitSeen(today);
        }

        const currentWeekPoints = series.points.filter(
          point =>
            point.date >= currentWeek.start && point.date <= currentWeek.end,
        );

        const completedWeekdaysSet = new Set(
          currentWeekPoints
            .filter(point => point.streakState === 'hit')
            .map(point => weekdayLabelFromLocalDateString(point.date))
            .filter((label): label is string => label != null),
        );
        if (isTodayComplete) {
          const todayLabel = weekdayLabelFromLocalDateString(today);
          if (todayLabel) completedWeekdaysSet.add(todayLabel);
        }

        setData({
          current: summary.currentGoalStreakDays,
          longest: summary.longestGoalStreakDays,
          isTodayComplete,
          shouldAnimateHitToday,
          completedWeekdays: Array.from(completedWeekdaysSet),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return data;
}
