import { DailyUsage } from '../../native/UsageStats';

export const formatTime = (hours: number, minutes: number): string => {
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const calculateAverage = (weeklyData: DailyUsage[]) => {
  if (weeklyData.length === 0) {
    return { hours: 0, minutes: 0 };
  }
  const totalMinutes = weeklyData.reduce(
    (acc, day) => acc + day.totalMinutes,
    0,
  );
  const avgMinutes = totalMinutes / weeklyData.length;
  const hours = Math.floor(avgMinutes / 60);
  const minutes = Math.round(avgMinutes % 60);
  return { hours, minutes };
};
