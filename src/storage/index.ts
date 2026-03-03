import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { MMKV, Mode } from 'react-native-mmkv';
import type { OnboardingData } from '../screens';
import { BlockingPlan, DailyActivity } from '../types';
import { generateUUID } from '../utils/guid';

/**
 * Synchronous fast-path for today's totals, shared with the Kotlin layer via MMKV.
 * Key names here must match MMKVStore.kt constants.
 * These reads are zero-latency (mmap, no bridge), enabling synchronous useState init.
 */
const _mmkv = new MMKV({ id: 'touchgrass_state', mode: Mode.MULTI_PROCESS });

// Low-frequency, Room-derived snapshot storage (separate MMKV file to avoid
// mixing historical/derived keys with the high-frequency today projection).
const _mmkvMetrics = new MMKV({
  id: 'touchgrass_metrics',
  mode: Mode.MULTI_PROCESS,
});

function localYyyyMmDd(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const fastStorage = {
  // Native-owned rollover marker. JS should treat mismatched days as a reset.
  getCurrentDay: (): string => _mmkv.getString('current_day') ?? '',

  getTodayDistance: (): number => _mmkv.getNumber('today_distance_meters') ?? 0,
  getTodayElapsed: (): number => _mmkv.getNumber('today_elapsed_seconds') ?? 0,
  getGoalsReached: (): boolean =>
    _mmkv.getBoolean('today_goals_reached') ?? false,

  // Native commit marker written after projecting today totals.
  getTodayLastUpdateMs: (): number =>
    _mmkv.getNumber('today_last_update_ms') ?? 0,

  setTodayDistance: (meters: number): void => {
    _mmkv.set('today_distance_meters', meters);
  },
  setTodayElapsed: (seconds: number): void => {
    _mmkv.set('today_elapsed_seconds', seconds);
  },
  setGoalsReached: (v: boolean): void => {
    _mmkv.set('today_goals_reached', v);
  },
  isAutoTracking: (): boolean => _mmkv.getBoolean('is_auto_tracking') ?? false,

  getPlanDay: (): string => _mmkv.getString('plan_day') ?? '',
  isPlanActiveToday: (): boolean =>
    _mmkv.getBoolean('plan_active_today') ?? false,

  // Optional expiry fence for notification correctness when JS is terminated.
  // If present and in the past, native should treat plan as inactive.
  getPlanActiveUntilMs: (): number =>
    _mmkv.getNumber('plan_active_until_ms') ?? 0,

  /** Write the aggregated goal so TrackingService can display correct progress in the notification. */
  setGoal(
    type: 'distance' | 'time' | 'none',
    value: number,
    unit: string,
  ): void {
    _mmkv.set('goal_type', type);
    _mmkv.set('goal_value', value);
    _mmkv.set('goal_unit', unit);
    // Also write typed keys so native side can display both distance/time goals.
    if (type === 'distance') {
      _mmkv.set('goal_distance_value', value);
      _mmkv.set('goal_distance_unit', unit);
    } else if (type === 'time') {
      _mmkv.set('goal_time_value', value);
      _mmkv.set('goal_time_unit', unit);
    } else {
      _mmkv.set('goal_distance_value', 0);
      _mmkv.set('goal_time_value', 0);
    }
  },
  setGoalDistance(value: number, unit: string) {
    _mmkv.set('goal_distance_value', value);
    _mmkv.set('goal_distance_unit', unit);
  },
  setGoalTime(value: number, unit: string) {
    _mmkv.set('goal_time_value', value);
    _mmkv.set('goal_time_unit', unit);
  },

  setPlanDay(day: string): void {
    _mmkv.set('plan_day', day);
  },
  setPlanActiveToday(active: boolean): void {
    _mmkv.set('plan_active_today', active);
  },

  setPlanActiveUntilMs(untilMs: number): void {
    _mmkv.set('plan_active_until_ms', untilMs);
  },
};

export type DailyMetricsSnapshot = {
  date: string;
  distanceMeters: number;
  elapsedSeconds: number;
  sessions: number;
  goalsReached: boolean;
  lastUpdatedMs: number;
};

export type RollingMetricsSnapshot = {
  window: '7d' | '30d' | '365d';
  startDate: string;
  endDate: string;
  distanceMeters: number;
  elapsedSeconds: number;
  days: number;
  goalsReachedDays: number;
  computedAtMs: number;
};

export type MonthlyMetricsSnapshot = {
  month: string; // YYYY-MM
  distanceMeters: number;
  elapsedSeconds: number;
  days: number;
  goalsReachedDays: number;
  computedAtMs: number;
};

export type AllTimeMetricsSnapshot = {
  distanceMeters: number;
  elapsedSeconds: number;
  sessions: number;
  goalsReachedDays: number;
  currentGoalStreakDays: number;
  longestGoalStreakDays: number;
  focusMinutes: number | null;
  notificationsBlockedTotal: number | null;
  blockedAttemptsTotal: number | null;
  computedAtMs: number;
  schemaVersion: number;
};

export const metricsStorage = {
  getDailyIndex(): string[] {
    const raw = _mmkvMetrics.getString('metrics:index:daily');
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  },

  getDaily(date: string): DailyMetricsSnapshot | null {
    const raw = _mmkvMetrics.getString(`metrics:daily:${date}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DailyMetricsSnapshot;
    } catch {
      return null;
    }
  },

  getRolling(window: '7d' | '30d' | '365d'): RollingMetricsSnapshot | null {
    const raw = _mmkvMetrics.getString(`metrics:rolling:${window}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RollingMetricsSnapshot;
    } catch {
      return null;
    }
  },

  getMonthly(month: string): MonthlyMetricsSnapshot | null {
    const raw = _mmkvMetrics.getString(`metrics:monthly:${month}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MonthlyMetricsSnapshot;
    } catch {
      return null;
    }
  },

  getAllTime(): AllTimeMetricsSnapshot | null {
    const raw = _mmkvMetrics.getString('metrics:alltime');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AllTimeMetricsSnapshot;
    } catch {
      return null;
    }
  },

  getStreakHitSeen(date: string): boolean {
    return _mmkvMetrics.getBoolean(`metrics:streak_hit_seen:${date}`) ?? false;
  },

  setStreakHitSeen(date: string): void {
    _mmkvMetrics.set(`metrics:streak_hit_seen:${date}`, true);
  },
};

export const PLANS_CHANGED_EVENT = 'plans_changed';

const KEYS = {
  ONBOARDING_COMPLETE: 'onboarding_complete',
  BLOCKING_PLANS: 'blocking_plans',
  GOAL_ANSWERS: 'goal_answers',
  DAILY_ACTIVITY: 'daily_activity',
  BACKGROUND_TRACKING: 'background_tracking_enabled',
} as const;

async function getStoredPlans(): Promise<BlockingPlan[]> {
  const raw = await AsyncStorage.getItem(KEYS.BLOCKING_PLANS);
  return raw ? JSON.parse(raw) : [];
}

async function savePlans(plans: BlockingPlan[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.BLOCKING_PLANS, JSON.stringify(plans));
  DeviceEventEmitter.emit(PLANS_CHANGED_EVENT);
}

export const storage = {
  async getOnboardingComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return value === 'true';
  },

  async getPlans(): Promise<BlockingPlan[]> {
    return (await getStoredPlans()).sort(x => (x.active ? -1 : 1));
  },

  async createPlan(plan: Omit<BlockingPlan, 'id'>): Promise<void> {
    const plans = await getStoredPlans();
    const newPlan: BlockingPlan = { ...plan, id: generateUUID(), active: true };
    await savePlans([...plans, newPlan]);
  },

  async updatePlan(updatedPlan: BlockingPlan): Promise<void> {
    const plans = await getStoredPlans();
    await savePlans(
      plans.map(p =>
        p.id === updatedPlan.id ? { ...updatedPlan, active: true } : p,
      ),
    );
  },

  async duplicatePlan(planId: string): Promise<void> {
    const plans = await getStoredPlans();
    const source = plans.find(p => p.id === planId);
    if (!source) return;
    const duplicate: BlockingPlan = {
      ...source,
      id: generateUUID(),
      active: true,
    };
    await savePlans([...plans, duplicate]);
  },

  async togglePlanActive(planId: string): Promise<void> {
    const plans = await getStoredPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    plan.active = !plan.active;
    await savePlans(plans);
  },

  async deletePlan(planId: string): Promise<void> {
    const plans = await getStoredPlans();
    await savePlans(plans.filter(p => p.id !== planId));
  },

  async getOnboardingData(): Promise<OnboardingData | null> {
    const [plans, answers] = await AsyncStorage.multiGet([
      KEYS.BLOCKING_PLANS,
      KEYS.GOAL_ANSWERS,
    ]);
    const blockingPlans = plans[1] ? JSON.parse(plans[1]) : [];
    const goalAnswers = answers[1] ? JSON.parse(answers[1]) : {};
    return { blockingPlans, answers: goalAnswers };
  },

  async saveOnboardingData(data: OnboardingData): Promise<void> {
    await AsyncStorage.multiSet([
      [KEYS.ONBOARDING_COMPLETE, 'true'],
      [KEYS.BLOCKING_PLANS, JSON.stringify(data.blockingPlans)],
      [KEYS.GOAL_ANSWERS, JSON.stringify(data.answers)],
    ]);
  },

  async getDailyActivities(): Promise<DailyActivity[]> {
    const raw = await AsyncStorage.getItem(KEYS.DAILY_ACTIVITY);
    return raw ? JSON.parse(raw) : [];
  },

  /**
   * Upsert today's activity entry. Accumulates distance/time across
   * multiple tracking sessions in the same day.
   */
  async saveDailyActivity(
    distanceMeters: number,
    elapsedSeconds: number,
    goalsReached: boolean,
  ): Promise<void> {
    const today = localYyyyMmDd();
    const activities = await this.getDailyActivities();

    const idx = activities.findIndex(a => a.date === today);
    if (idx >= 0) {
      activities[idx].distanceMeters += distanceMeters;
      activities[idx].elapsedSeconds += elapsedSeconds;
      activities[idx].goalsReached =
        activities[idx].goalsReached || goalsReached;
    } else {
      activities.push({
        date: today,
        distanceMeters,
        elapsedSeconds,
        goalsReached,
      });
    }

    await AsyncStorage.setItem(KEYS.DAILY_ACTIVITY, JSON.stringify(activities));
  },

  async getTodayActivity(): Promise<DailyActivity> {
    const today = localYyyyMmDd();
    const activities = await this.getDailyActivities();
    return (
      activities.find(a => a.date === today) ?? {
        date: today,
        distanceMeters: 0,
        elapsedSeconds: 0,
        goalsReached: false,
      }
    );
  },

  async getBackgroundTrackingEnabled(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.BACKGROUND_TRACKING);
    return value === 'true';
  },

  async setBackgroundTrackingEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.BACKGROUND_TRACKING, String(enabled));
  },
};
