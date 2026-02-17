// Plan
export type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type DurationType = 'entire_day' | 'specific_hours';
export type CriteriaType = 'permanent' | 'distance' | 'time';
export type DistanceUnit = 'km' | 'mi';

export const DAYS: { key: DayKey; label: string }[] = [
  { key: 'MON', label: 'Mon' },
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

export const KM_TO_MI = 0.621371;
export const MI_TO_KM = 1.60934;

export interface BlockedApp {
  id: string;
  name: string;
  icon?: string;
}

export interface BlockingPlan {
  id: string;
  active: boolean;
  days: DayKey[];
  duration:
    | { type: 'entire_day' }
    | { type: 'specific_hours'; from: string; to: string };
  criteria:
    | { type: 'distance'; value: number; unit: DistanceUnit }
    | { type: 'time'; value: number }
    | { type: 'permanent' };
  blockedApps: BlockedApp[];
}

// Daily activity log
export interface DailyActivity {
  date: string; // YYYY-MM-DD
  distanceMeters: number;
  elapsedSeconds: number;
  goalsReached: boolean;
}
