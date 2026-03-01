import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  EmitterSubscription,
} from 'react-native';

const { TrackingModule } = NativeModules;

const isAvailable = Platform.OS === 'android' && TrackingModule != null;

export interface TrackingProgress {
  distanceMeters: number;
  elapsedSeconds: number;
  goalReached: boolean;
}

export type NativeTrackingMode = 'idle' | 'manual' | 'auto';

export interface TrackingAnchor {
  todayDistanceMeters: number;
  todayElapsedSeconds: number;
  sessionDistanceMeters: number;
  sessionElapsedSeconds: number;
  goalReached: boolean;
  isTracking: boolean;
  mode: NativeTrackingMode;
  shouldTick: boolean;
  lastUpdateMs: number;
}

export type MetricsPeriod = 'day' | 'week' | 'month' | 'alltime';

export interface NativeMetricsSummary {
  period: MetricsPeriod;
  startDate: string;
  endDate: string;
  distanceMeters: number;
  elapsedSeconds: number;
  sessions: number;
  goalsReachedDays: number;
  blockedAttempts: number;
  notificationsBlocked: number;
  currentGoalStreakDays: number;
  longestGoalStreakDays: number;
  computedAtMs: number;
}

export interface NativeMetricsPoint {
  date: string;
  distanceMeters: number;
  elapsedSeconds: number;
  goalsReached: boolean;
  sessions: number;
  blockedAttempts: number;
  notificationsBlocked: number;
}

export interface NativeMetricsSeries {
  period: MetricsPeriod;
  startDate: string;
  endDate: string;
  points: NativeMetricsPoint[];
  computedAtMs: number;
}

const emitter = isAvailable ? new NativeEventEmitter(TrackingModule) : null;

export const Tracking = {
  isAvailable,

  async startTracking(
    goalType: 'distance' | 'time',
    goalValue: number,
    goalUnit: string,
  ): Promise<boolean> {
    if (!isAvailable) {
      console.warn(
        'TrackingModule is not available. Did you rebuild the Android app?',
      );
      return false;
    }
    return TrackingModule.startTracking(goalType, goalValue, goalUnit);
  },

  async stopTracking(): Promise<boolean> {
    if (!isAvailable) {
      return false;
    }
    return TrackingModule.stopTracking();
  },

  async getProgress(): Promise<TrackingProgress> {
    if (!isAvailable) {
      return { distanceMeters: 0, elapsedSeconds: 0, goalReached: false };
    }
    return TrackingModule.getProgress();
  },

  async getTrackingAnchor(): Promise<TrackingAnchor> {
    if (!isAvailable) {
      return {
        todayDistanceMeters: 0,
        todayElapsedSeconds: 0,
        sessionDistanceMeters: 0,
        sessionElapsedSeconds: 0,
        goalReached: false,
        isTracking: false,
        mode: 'idle',
        shouldTick: false,
        lastUpdateMs: Date.now(),
      };
    }
    return TrackingModule.getTrackingAnchor();
  },

  onProgress(
    callback: (progress: TrackingProgress) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onTrackingProgress', callback);
  },

  onAnchor(
    callback: (anchor: TrackingAnchor) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onTrackingAnchor', callback);
  },

  onGoalReached(callback: () => void): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onGoalReached', callback);
  },

  onTrackingStarted(callback: () => void): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onTrackingStarted', callback);
  },

  onTrackingStopped(callback: () => void): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onTrackingStopped', callback);
  },

  async getUnsavedSession(): Promise<{
    date: string;
    distanceMeters: number;
    elapsedSeconds: number;
    goalsReached: boolean;
  } | null> {
    if (!isAvailable) return null;
    return TrackingModule.getUnsavedSession();
  },

  /**
   * Returns today's accumulated totals from Room (native SQLite).
   * Faster and more reliable than AsyncStorage for headless task recovery.
   */
  async getDailyTotalNative(): Promise<{
    distanceMeters: number;
    elapsedSeconds: number;
    goalsReached: boolean;
  } | null> {
    if (!isAvailable) return null;
    return TrackingModule.getDailyTotalNative();
  },

  /**
   * Returns whether auto-tracking is currently active per MMKV.
   * Useful on app open before the first progress event arrives.
   */
  async getIsAutoTracking(): Promise<boolean> {
    if (!isAvailable) return false;
    return TrackingModule.getIsAutoTracking();
  },

  async getMetricsSummary(
    period: MetricsPeriod,
    anchorDate?: string,
  ): Promise<NativeMetricsSummary> {
    if (!isAvailable) {
      const today = new Date().toISOString().slice(0, 10);
      return {
        period,
        startDate: today,
        endDate: today,
        distanceMeters: 0,
        elapsedSeconds: 0,
        sessions: 0,
        goalsReachedDays: 0,
        blockedAttempts: 0,
        notificationsBlocked: 0,
        currentGoalStreakDays: 0,
        longestGoalStreakDays: 0,
        computedAtMs: Date.now(),
      };
    }
    return TrackingModule.getMetricsSummaryNative(period, anchorDate ?? null);
  },

  async getMetricsSeries(
    period: MetricsPeriod,
    anchorDate?: string,
  ): Promise<NativeMetricsSeries> {
    if (!isAvailable) {
      const today = new Date().toISOString().slice(0, 10);
      return {
        period,
        startDate: today,
        endDate: today,
        points: [],
        computedAtMs: Date.now(),
      };
    }
    return TrackingModule.getMetricsSeriesNative(period, anchorDate ?? null);
  },

  /**
   * Starts TrackingService in IDLE state (foreground, GPS off).
   * The service transitions to TRACKING when MotionTracker (MotionTrackingBridge) detects motion.
   * Call this when the user enables background tracking.
   */
  async startIdleService(): Promise<boolean> {
    if (!isAvailable) return false;
    return TrackingModule.startIdleService();
  },

  /**
   * Stops the background idle/tracking service entirely.
   * Call this when the user disables background tracking.
   */
  async stopIdleService(): Promise<boolean> {
    if (!isAvailable) return false;
    return TrackingModule.stopIdleService();
  },
};
