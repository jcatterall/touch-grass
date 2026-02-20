import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  AppState,
  DeviceEventEmitter,
  EmitterSubscription,
} from 'react-native';
import { storage, fastStorage, PLANS_CHANGED_EVENT } from '../storage';
import { BlockingPlan, DayKey } from '../types';
import { MotionTracker, MotionEvent } from '../tracking/MotionTracker';
import { Tracking, TrackingProgress } from '../tracking/Tracking';
import { TrackingPermissions } from '../tracking/Permissions';
import { AppBlocker } from '../native/AppBlocker';

const DAY_MAP: Record<number, DayKey> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

export function getTodayKey(): DayKey {
  return DAY_MAP[new Date().getDay()];
}

export function isWithinDuration(plan: BlockingPlan): boolean {
  if (plan.duration.type === 'entire_day') return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [fromH, fromM] = plan.duration.from.split(':').map(Number);
  const [toH, toM] = plan.duration.to.split(':').map(Number);

  const fromMinutes = fromH * 60 + fromM;
  const toMinutes = toH * 60 + toM;

  return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
}

export function findActivePlansForToday(plans: BlockingPlan[]): BlockingPlan[] {
  const today = getTodayKey();
  return plans.filter(
    plan =>
      plan.active &&
      plan.days.includes(today) &&
      isWithinDuration(plan) &&
      plan.criteria.type !== 'permanent',
  );
}

export function findBlockingPlansForToday(
  plans: BlockingPlan[],
): BlockingPlan[] {
  const today = getTodayKey();
  return plans.filter(
    plan =>
      plan.active &&
      plan.days.includes(today) &&
      isWithinDuration(plan) &&
      plan.blockedApps.length > 0,
  );
}

export interface AggregatedGoals {
  totalDistanceMeters: number;
  totalTimeSeconds: number;
  hasDistanceGoal: boolean;
  hasTimeGoal: boolean;
}

export function aggregateGoals(plans: BlockingPlan[]): AggregatedGoals {
  let totalDistanceMeters = 0;
  let totalTimeSeconds = 0;

  for (const plan of plans) {
    if (plan.criteria.type === 'distance') {
      const meters =
        plan.criteria.unit === 'mi'
          ? plan.criteria.value * 1609.34
          : plan.criteria.value * 1000;
      totalDistanceMeters += meters;
    } else if (plan.criteria.type === 'time') {
      totalTimeSeconds += plan.criteria.value * 60;
    }
  }

  return {
    totalDistanceMeters,
    totalTimeSeconds,
    hasDistanceGoal: totalDistanceMeters > 0,
    hasTimeGoal: totalTimeSeconds > 0,
  };
}

function checkAllGoalsReached(
  goals: AggregatedGoals,
  progress: TrackingProgress,
): boolean {
  if (!goals.hasDistanceGoal && !goals.hasTimeGoal) return false;
  const distanceMet =
    !goals.hasDistanceGoal ||
    progress.distanceMeters >= goals.totalDistanceMeters;
  const timeMet =
    !goals.hasTimeGoal || progress.elapsedSeconds >= goals.totalTimeSeconds;
  return distanceMet && timeMet;
}

export type TrackingMode = 'idle' | 'manual' | 'auto';

export interface DebugInfo {
  motionState: string;
  motionActivity: string;
  motionServiceRunning: boolean;
  nativeServiceRunning: boolean;
}

export interface TrackingState {
  isTracking: boolean;
  isAutoTracking: boolean;
  trackingMode: TrackingMode;
  progress: TrackingProgress;
  activePlans: BlockingPlan[];
  goals: AggregatedGoals;
  allGoalsReached: boolean;
  permissionsGranted: boolean;
  backgroundTrackingEnabled: boolean;
  debugInfo: DebugInfo;
  startManual: () => Promise<void>;
  stop: () => Promise<void>;
  toggleBackgroundTracking: () => Promise<void>;
}

export function useTracking(): TrackingState {
  const [isTracking, setIsTracking] = useState(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('idle');

  // dailyBaseline holds distance/elapsed from sessions that have already *ended* today.
  // It is intentionally NOT read from MMKV at init time because MMKV's today_distance
  // accumulates live during an active session — reading it here while a session is running
  // would double-count the current session (baseline + sessionProgress both include it).
  // Instead we set it to zero and let recover() fill sessionProgress from the live service,
  // or let onTrackingStopped fill it from MMKV after the session ends.
  const [dailyBaseline, setDailyBaseline] = useState<TrackingProgress>({
    distanceMeters: 0,
    elapsedSeconds: 0,
    goalReached: false,
  });

  const [sessionProgress, setSessionProgress] = useState<TrackingProgress>({
    distanceMeters: 0,
    elapsedSeconds: 0,
    goalReached: false,
  });

  const [activePlans, setActivePlans] = useState<BlockingPlan[]>([]);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] =
    useState(false);

  // MotionTracker debug state
  const [debugMotionState, setDebugMotionState] = useState('STILL');
  const [debugMotionActivity, setDebugMotionActivity] = useState('unknown');
  const [debugMotionServiceRunning, setDebugMotionServiceRunning] =
    useState(false);
  const [debugNativeRunning, setDebugNativeRunning] = useState(false);

  const progressSub = useRef<EmitterSubscription | null>(null);
  const trackingStarted = useRef(false);

  // Time interpolation: store the last native update so we can tick every second
  const lastNativeUpdate = useRef<{
    elapsedSeconds: number;
    distanceMeters: number;
    goalReached: boolean;
    timestamp: number;
  } | null>(null);

  // MotionTracker subscription refs
  const motionStartedSub = useRef<EmitterSubscription | null>(null);
  const motionStoppedSub = useRef<EmitterSubscription | null>(null);
  const motionAutoPausedSub = useRef<EmitterSubscription | null>(null);
  const motionResumedSub = useRef<EmitterSubscription | null>(null);

  const goals = useMemo(() => aggregateGoals(activePlans), [activePlans]);

  // Keep the native notification in sync with the real aggregated goal.
  // TrackingService reads these MMKV keys to display accurate progress.
  useEffect(() => {
    if (goals.hasDistanceGoal) {
      fastStorage.setGoal('distance', goals.totalDistanceMeters, 'm');
    } else if (goals.hasTimeGoal) {
      fastStorage.setGoal('time', goals.totalTimeSeconds, 's');
    } else {
      fastStorage.setGoal('none', 0, '');
    }
  }, [goals]);

  // Combined progress = daily baseline + current session.
  // When tracking is active: sessionProgress comes from onProgress events (live GPS data).
  // When not tracking: dailyBaseline holds today's total from completed sessions.
  const progress = useMemo<TrackingProgress>(
    () => ({
      distanceMeters:
        dailyBaseline.distanceMeters + sessionProgress.distanceMeters,
      elapsedSeconds:
        dailyBaseline.elapsedSeconds + sessionProgress.elapsedSeconds,
      goalReached: dailyBaseline.goalReached || sessionProgress.goalReached,
    }),
    [dailyBaseline, sessionProgress],
  );

  const allGoalsReached = useMemo(
    () => checkAllGoalsReached(goals, progress),
    [goals, progress],
  );

  // Load active plans
  useEffect(() => {
    const load = async () => {
      const plans = await storage.getPlans();
      const active = findActivePlansForToday(plans);
      setActivePlans(active);
    };
    load();

    const sub = DeviceEventEmitter.addListener(PLANS_CHANGED_EVENT, load);
    const interval = setInterval(load, 300_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  // Sync blocker service with current plan/progress state.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const syncBlocker = async () => {
      const plans = await storage.getPlans();
      const blockingPlans = findBlockingPlansForToday(plans);
      const currentProgress = progressRef.current;

      if (blockingPlans.length === 0) {
        await AppBlocker.stopBlocker();
        return;
      }

      const unmetPlans = blockingPlans.filter(plan => {
        if (plan.criteria.type === 'permanent') return true;
        if (plan.criteria.type === 'distance') {
          const goalMeters =
            plan.criteria.unit === 'mi'
              ? plan.criteria.value * 1609.34
              : plan.criteria.value * 1000;
          return currentProgress.distanceMeters < goalMeters;
        }
        if (plan.criteria.type === 'time') {
          return currentProgress.elapsedSeconds < plan.criteria.value * 60;
        }
        return false;
      });

      if (unmetPlans.length === 0) {
        await AppBlocker.updateBlockerConfig([], true, false);
        return;
      }

      const blockedPackages = [
        ...new Set(unmetPlans.flatMap(p => p.blockedApps.map(a => a.id))),
      ];
      const hasPermanent = unmetPlans.some(
        p => p.criteria.type === 'permanent',
      );

      await AppBlocker.updateBlockerConfig(
        blockedPackages,
        false,
        hasPermanent,
      );
      await AppBlocker.startBlocker();
    };

    syncBlocker();
    const interval = setInterval(syncBlocker, 15_000);
    return () => clearInterval(interval);
  }, [activePlans]);

  // Check permissions + load background tracking state on mount
  useEffect(() => {
    TrackingPermissions.checkAll().then(setPermissionsGranted);
    storage.getBackgroundTrackingEnabled().then(enabled => {
      setBackgroundTrackingEnabled(enabled);
      if (enabled) setDebugMotionServiceRunning(true);
    });
  }, []);

  // Sync live state from the native service. Called on mount and on app foreground resume.
  // Uses getIsAutoTracking() (synchronous MMKV flag) to detect an active session even when
  // distance/elapsed is still 0 (e.g. GPS just started, no fixes yet).
  const syncFromNativeService = useCallback(async () => {
    const isAutoTracking = await Tracking.getIsAutoTracking();
    if (isAutoTracking) {
      const current = await Tracking.getProgress();
      setSessionProgress(current);
      setIsTracking(true);
      setTrackingMode('auto');
      setDebugNativeRunning(true);
      trackingStarted.current = true;
      lastNativeUpdate.current = {
        elapsedSeconds: current.elapsedSeconds,
        distanceMeters: current.distanceMeters,
        goalReached: current.goalReached,
        timestamp: Date.now(),
      };
    } else {
      // No active session — load today's completed totals from MMKV as the baseline.
      // This only runs when not tracking, so there's no double-count risk.
      setDailyBaseline({
        distanceMeters: fastStorage.getTodayDistance(),
        elapsedSeconds: fastStorage.getTodayElapsed(),
        goalReached: fastStorage.getGoalsReached(),
      });
    }
  }, []);

  // On mount: restore state from running service
  useEffect(() => {
    syncFromNativeService();
  }, [syncFromNativeService]);

  // On app foreground resume: re-sync in case the native service state changed
  // while the JS layer was suspended (background → foreground transition).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        syncFromNativeService();
      }
    });
    return () => sub.remove();
  }, [syncFromNativeService]);

  // Subscribe to TrackingService progress events once on mount
  useEffect(() => {
    progressSub.current = Tracking.onProgress(p => {
      lastNativeUpdate.current = {
        elapsedSeconds: p.elapsedSeconds,
        distanceMeters: p.distanceMeters,
        goalReached: p.goalReached,
        timestamp: Date.now(),
      };
      setSessionProgress(p);
    });
    return () => {
      progressSub.current?.remove();
      progressSub.current = null;
    };
  }, []);

  // Listen for native tracking start events (e.g., from auto-start via MotionTrackingBridge)
  useEffect(() => {
    const sub = Tracking.onTrackingStarted(() => {
      // Always update state on this event — it's the authoritative signal that a new
      // GPS session has started. Reset trackingStarted guard so this always fires.
      trackingStarted.current = true;
      lastNativeUpdate.current = {
        elapsedSeconds: 0,
        distanceMeters: 0,
        goalReached: false,
        timestamp: Date.now(),
      };
      setSessionProgress({
        distanceMeters: 0,
        elapsedSeconds: 0,
        goalReached: false,
      });
      setIsTracking(true);
      setTrackingMode('auto');
      setDebugNativeRunning(true);
    });
    return () => sub?.remove();
  }, []);

  // Listen for native tracking stopped events.
  // After TrackingService stops, MMKV holds the completed day total (including the session
  // that just ended). Read it into dailyBaseline and clear sessionProgress.
  useEffect(() => {
    const sub = Tracking.onTrackingStopped(() => {
      trackingStarted.current = false;
      lastNativeUpdate.current = null;
      setIsTracking(false);
      setTrackingMode('idle');
      setDebugNativeRunning(false);
      setDailyBaseline({
        distanceMeters: fastStorage.getTodayDistance(),
        elapsedSeconds: fastStorage.getTodayElapsed(),
        goalReached: fastStorage.getGoalsReached(),
      });
      setSessionProgress({
        distanceMeters: 0,
        elapsedSeconds: 0,
        goalReached: false,
      });
    });
    return () => sub?.remove();
  }, []);

  // 1-second interval to interpolate elapsed time between native updates.
  useEffect(() => {
    if (!isTracking) return;

    const timer = setInterval(() => {
      const last = lastNativeUpdate.current;
      if (!last) return;

      const elapsed = (Date.now() - last.timestamp) / 1000;
      if (elapsed < 1) return;

      setSessionProgress(prev => ({
        ...prev,
        elapsedSeconds: last.elapsedSeconds + elapsed,
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [isTracking]);

  // Start tracking — uses a large goal for the native service so JS handles goal-reached logic
  const startTracking = useCallback(
    async (mode: TrackingMode) => {
      if (trackingStarted.current) return;
      if (activePlans.length === 0) return;

      const hasPerms = await TrackingPermissions.checkAll();
      if (!hasPerms) {
        const granted = await TrackingPermissions.requestAll();
        setPermissionsGranted(granted);
        if (!granted) return;
      }

      await Tracking.startTracking('distance', 999, 'km');

      trackingStarted.current = true;
      lastNativeUpdate.current = {
        elapsedSeconds: 0,
        distanceMeters: 0,
        goalReached: false,
        timestamp: Date.now(),
      };
      setSessionProgress({
        distanceMeters: 0,
        elapsedSeconds: 0,
        goalReached: false,
      });
      setIsTracking(true);
      setTrackingMode(mode);
      setDebugNativeRunning(true);
    },
    [activePlans],
  );

  const saveAndResetSession = useCallback(() => {
    setDailyBaseline({
      distanceMeters: fastStorage.getTodayDistance(),
      elapsedSeconds: fastStorage.getTodayElapsed(),
      goalReached: fastStorage.getGoalsReached(),
    });
    setSessionProgress({
      distanceMeters: 0,
      elapsedSeconds: 0,
      goalReached: false,
    });
  }, []);

  // Auto-stop when all goals reached
  useEffect(() => {
    if (allGoalsReached && isTracking) {
      Tracking.stopTracking();
      setIsTracking(false);
      setTrackingMode('idle');
      trackingStarted.current = false;
      lastNativeUpdate.current = null;
      saveAndResetSession();
    }
  }, [allGoalsReached, isTracking, saveAndResetSession]);

  const stop = useCallback(async () => {
    const finalProgress = await Tracking.getProgress();
    const dist = finalProgress.distanceMeters || sessionProgress.distanceMeters;
    const elapsed =
      finalProgress.elapsedSeconds || sessionProgress.elapsedSeconds;

    await Tracking.stopTracking();
    setIsTracking(false);
    setTrackingMode('idle');
    trackingStarted.current = false;
    lastNativeUpdate.current = null;
    setDebugNativeRunning(false);
    setDailyBaseline(prev => ({
      distanceMeters: prev.distanceMeters + dist,
      elapsedSeconds: prev.elapsedSeconds + elapsed,
      goalReached: prev.goalReached || allGoalsReached,
    }));
    setSessionProgress({
      distanceMeters: 0,
      elapsedSeconds: 0,
      goalReached: false,
    });
  }, [sessionProgress, allGoalsReached]);

  const startManual = useCallback(async () => {
    if (trackingMode === 'auto' && isTracking) return;
    await startTracking('manual');
  }, [trackingMode, isTracking, startTracking]);

  // Toggle background tracking using MotionTracker + idle TrackingService
  const toggleBackgroundTracking = useCallback(async () => {
    if (backgroundTrackingEnabled) {
      // Stop MotionTracker and the idle service
      await MotionTracker.stopMonitoring().catch(() => {});
      await Tracking.stopIdleService().catch(() => {});
      await storage.setBackgroundTrackingEnabled(false);
      setBackgroundTrackingEnabled(false);
      setDebugMotionServiceRunning(false);

      // Clean up MotionTracker event subscriptions
      motionStartedSub.current?.remove();
      motionStoppedSub.current?.remove();
      motionAutoPausedSub.current?.remove();
      motionResumedSub.current?.remove();
      motionStartedSub.current = null;
      motionStoppedSub.current = null;
      motionAutoPausedSub.current = null;
      motionResumedSub.current = null;
    } else {
      const granted = await TrackingPermissions.requestAll();
      setPermissionsGranted(granted);
      if (!granted) return;

      // startIdleService starts both TrackingService (IDLE) and MotionService
      await Tracking.startIdleService().catch(() => {});
      await storage.setBackgroundTrackingEnabled(true);
      setBackgroundTrackingEnabled(true);
      setDebugMotionServiceRunning(true);
    }
  }, [backgroundTrackingEnabled]);

  // MotionTracker event subscriptions — update UI state in real time.
  // The actual TrackingService start/stop is handled natively via MotionTrackingBridge.
  useEffect(() => {
    if (!backgroundTrackingEnabled) {
      setDebugMotionState('STILL');
      setDebugMotionActivity('unknown');
      return;
    }

    motionStartedSub.current = MotionTracker.onMotionStarted(
      (event: MotionEvent) => {
        setDebugMotionState('MOVING');
        setDebugMotionActivity(event.activityType);
        // UI sync: TrackingService auto-started via MotionTrackingBridge natively.
        // Update JS isTracking state if not already set.
        if (!trackingStarted.current) {
          trackingStarted.current = true;
          lastNativeUpdate.current = {
            elapsedSeconds: 0,
            distanceMeters: 0,
            goalReached: false,
            timestamp: Date.now(),
          };
          setSessionProgress({
            distanceMeters: 0,
            elapsedSeconds: 0,
            goalReached: false,
          });
          setIsTracking(true);
          setTrackingMode('auto');
          setDebugNativeRunning(true);
        }
      },
    );

    motionAutoPausedSub.current = MotionTracker.onMotionAutoPaused(
      (event: MotionEvent) => {
        setDebugMotionState('AUTO_PAUSED');
        setDebugMotionActivity(event.activityType);
      },
    );

    motionResumedSub.current = MotionTracker.onMotionResumed(
      (event: MotionEvent) => {
        setDebugMotionState('MOVING');
        setDebugMotionActivity(event.activityType);
      },
    );

    motionStoppedSub.current = MotionTracker.onMotionStopped(
      (event: MotionEvent) => {
        setDebugMotionState('STOPPED');
        setDebugMotionActivity(event.activityType);
        // TrackingService will fire onTrackingStopped separately (via MotionTrackingBridge).
        // That event resets isTracking/trackingMode in the listener above.
      },
    );

    return () => {
      motionStartedSub.current?.remove();
      motionStoppedSub.current?.remove();
      motionAutoPausedSub.current?.remove();
      motionResumedSub.current?.remove();
      motionStartedSub.current = null;
      motionStoppedSub.current = null;
      motionAutoPausedSub.current = null;
      motionResumedSub.current = null;
    };
  }, [backgroundTrackingEnabled]);

  const debugInfo = useMemo<DebugInfo>(
    () => ({
      motionState: debugMotionState,
      motionActivity: debugMotionActivity,
      motionServiceRunning: debugMotionServiceRunning,
      nativeServiceRunning: debugNativeRunning,
    }),
    [
      debugMotionState,
      debugMotionActivity,
      debugMotionServiceRunning,
      debugNativeRunning,
    ],
  );

  return {
    isTracking,
    isAutoTracking: trackingMode === 'auto' && isTracking,
    trackingMode,
    progress,
    activePlans,
    goals,
    allGoalsReached,
    permissionsGranted,
    backgroundTrackingEnabled,
    debugInfo,
    startManual,
    stop,
    toggleBackgroundTracking,
  };
}
