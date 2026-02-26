import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  AppState,
  DeviceEventEmitter,
  EmitterSubscription,
} from 'react-native';
import { storage, fastStorage, PLANS_CHANGED_EVENT } from '../storage';
import { NativeModules } from 'react-native';
import { BlockingPlan, DayKey } from '../types';
import {
  MotionTracker,
  MotionStateChangedEvent,
  MotionState as MotionStateType,
} from '../tracking/MotionTracker';
import {
  Tracking,
  TrackingAnchor,
  TrackingProgress,
} from '../tracking/Tracking';
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

function todayYyyyMmDd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monotonicNowMs(): number {
  // Prefer monotonic time so UI ticking is immune to wall-clock changes.
  // Fallback to Date.now() if performance.now is unavailable.
  const p = (globalThis as unknown as { performance?: { now?: () => number } })
    ?.performance;
  if (p?.now) return p.now();
  return Date.now();
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
    plan => plan.active && plan.days.includes(today) && isWithinDuration(plan),
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
  motionState: MotionStateType;
  motionActivity: string;
  motionServiceRunning: boolean;
  nativeServiceRunning: boolean;
  currentActivity: string;
  stepDetected: boolean;
  gpsActive: boolean;
  variance: number;
  cadence: number;
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

  const dayRef = useRef<string>(todayYyyyMmDd());

  // Single source of truth for "today progress": native projects canonical totals into
  // MMKV, and the TrackingModule progress/event stream exposes the same totals.
  const [todayProgress, setTodayProgress] = useState<TrackingProgress>(() => ({
    distanceMeters: fastStorage.getTodayDistance(),
    elapsedSeconds: fastStorage.getTodayElapsed(),
    goalReached: fastStorage.getGoalsReached(),
  }));

  const [activePlans, setActivePlans] = useState<BlockingPlan[]>([]);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] =
    useState(false);

  // MotionTracker debug state
  const [debugMotionState, setDebugMotionState] =
    useState<MotionStateType>('UNKNOWN');
  const [debugMotionActivity, setDebugMotionActivity] = useState('unknown');
  const [debugMotionServiceRunning, setDebugMotionServiceRunning] =
    useState(false);
  const [debugNativeRunning, setDebugNativeRunning] = useState(false);
  const [debugCurrentActivity, setDebugCurrentActivity] = useState('unknown');
  const [debugStepDetected, setDebugStepDetected] = useState(false);
  const [debugGpsActive, setDebugGpsActive] = useState(false);
  const [debugVariance, setDebugVariance] = useState(0);
  const [debugCadence, setDebugCadence] = useState(0);

  const progressSub = useRef<EmitterSubscription | null>(null);
  const trackingStarted = useRef(false);

  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState ?? 'active');
  const postStopSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const STOP_GRACE_MS = 300;

  const anchorRef = useRef<{
    baseTodayDistanceMeters: number;
    baseTodayElapsedSeconds: number;
    baseSessionDistanceMeters: number;
    baseSessionElapsedSeconds: number;
    goalReached: boolean;
    isTracking: boolean;
    mode: TrackingMode;
    shouldTick: boolean;
    anchorPerfMs: number;
  } | null>(null);

  // MotionTracker subscription refs
  const motionStateChangedSub = useRef<EmitterSubscription | null>(null);
  const motionStateUpdateSub = useRef<EmitterSubscription | null>(null);

  const goals = useMemo(() => aggregateGoals(activePlans), [activePlans]);

  const stopUiTick = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const clearPostStopSync = useCallback(() => {
    if (postStopSyncTimeoutRef.current) {
      clearTimeout(postStopSyncTimeoutRef.current);
      postStopSyncTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopUiTick();
      clearPostStopSync();
    };
  }, [stopUiTick, clearPostStopSync]);

  const ensureUiTick = useCallback(() => {
    stopUiTick();

    if (appStateRef.current !== 'active') return;
    const a = anchorRef.current;
    if (!a?.shouldTick) return;
    if (!a.isTracking) return;

    tickIntervalRef.current = setInterval(() => {
      const current = anchorRef.current;
      if (!current || !current.shouldTick) return;
      if (!current.isTracking) return;

      const deltaSeconds = Math.floor(
        (monotonicNowMs() - current.anchorPerfMs) / 1000,
      );
      const nextElapsed = Math.max(
        current.baseTodayElapsedSeconds,
        current.baseTodayElapsedSeconds + Math.max(0, deltaSeconds),
      );

      setTodayProgress(prev => {
        if (prev.elapsedSeconds === nextElapsed) return prev;
        return {
          ...prev,
          elapsedSeconds: nextElapsed,
        };
      });
    }, 1000);
  }, [stopUiTick]);

  const applyAnchor = useCallback(
    (anchor: TrackingAnchor) => {
      const mode: TrackingMode = !anchor.isTracking
        ? 'idle'
        : anchor.mode === 'manual'
        ? 'manual'
        : anchor.mode === 'auto'
        ? 'auto'
        : 'idle';

      const todayKey = todayYyyyMmDd();
      const isNewDay = dayRef.current !== todayKey;
      if (isNewDay) dayRef.current = todayKey;

      // Update authoritative flags
      setIsTracking(anchor.isTracking);
      setTrackingMode(mode);
      setDebugNativeRunning(anchor.isTracking);
      trackingStarted.current = anchor.isTracking;

      // Baseline snapshot (authoritative totals at anchor time)
      setTodayProgress(prev => {
        if (isNewDay) {
          return {
            distanceMeters: anchor.todayDistanceMeters,
            elapsedSeconds: anchor.todayElapsedSeconds,
            goalReached: anchor.goalReached,
          };
        }

        const nextDistance = Math.max(
          prev.distanceMeters,
          anchor.todayDistanceMeters,
        );
        const nextElapsed = Math.max(
          prev.elapsedSeconds,
          anchor.todayElapsedSeconds,
        );
        const nextGoal = prev.goalReached || anchor.goalReached;

        if (
          prev.distanceMeters === nextDistance &&
          prev.elapsedSeconds === nextElapsed &&
          prev.goalReached === nextGoal
        ) {
          return prev;
        }

        return {
          distanceMeters: nextDistance,
          elapsedSeconds: nextElapsed,
          goalReached: nextGoal,
        };
      });

      anchorRef.current = {
        baseTodayDistanceMeters: anchor.todayDistanceMeters,
        baseTodayElapsedSeconds: anchor.todayElapsedSeconds,
        baseSessionDistanceMeters: anchor.sessionDistanceMeters,
        baseSessionElapsedSeconds: anchor.sessionElapsedSeconds,
        goalReached: anchor.goalReached,
        isTracking: anchor.isTracking,
        mode,
        shouldTick: anchor.shouldTick,
        anchorPerfMs: monotonicNowMs(),
      };

      // Re-evaluate whether we should run the 1Hz UI ticker.
      ensureUiTick();
    },
    [ensureUiTick],
  );

  // Persist the native-readable notion of "active plan for today".
  // Used by the Android notification renderer (strict two-state contract).
  useEffect(() => {
    try {
      const hasActivePlanNow = activePlans.length > 0;
      fastStorage.setPlanActiveToday(hasActivePlanNow);
      fastStorage.setPlanDay(hasActivePlanNow ? todayYyyyMmDd() : '');
      NativeModules.TrackingModule?.notifyGoalsUpdated?.()?.catch?.(() => {});
    } catch {
      // best-effort
    }
  }, [activePlans]);

  // Keep the native notification in sync with the real aggregated goal.
  // TrackingService reads these MMKV keys to display accurate progress.
  useEffect(() => {
    try {
      if (goals.hasDistanceGoal && goals.hasTimeGoal) {
        // Write both typed keys so native notification can display both.
        fastStorage.setGoalDistance(goals.totalDistanceMeters, 'm');
        fastStorage.setGoalTime(goals.totalTimeSeconds, 's');
        // Also update aggregated compatibility key (distance first)
        fastStorage.setGoal('distance', goals.totalDistanceMeters, 'm');
      } else if (goals.hasDistanceGoal) {
        fastStorage.setGoal('distance', goals.totalDistanceMeters, 'm');
      } else if (goals.hasTimeGoal) {
        fastStorage.setGoal('time', goals.totalTimeSeconds, 's');
      } else {
        fastStorage.setGoal('none', 0, '');
      }
      NativeModules.TrackingModule?.notifyGoalsUpdated?.()?.catch?.(() => {});
    } catch {
      // best-effort
    }
  }, [goals]);

  const progress = todayProgress;

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
        // No active blocking plans today — clear native blocker config
        // so native notification reflects that there are no active blocks.
        try {
          await AppBlocker.updateBlockerConfig([], true, false);
        } catch {
          // best-effort
        }
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
  // Uses a native "anchor" snapshot (today totals + eligibility) so JS can render
  // an accurate 1Hz foreground timer without relying on 1Hz bridge events.
  const syncFromNativeService = useCallback(async () => {
    const todayKey = todayYyyyMmDd();
    const isNewDay = dayRef.current !== todayKey;
    if (isNewDay) dayRef.current = todayKey;

    try {
      const anchor = await Tracking.getTrackingAnchor();
      // If the native service responds, prefer the anchor snapshot for totals.
      // Even an idle anchor can be fresher than the MMKV projection right after stop.
      applyAnchor(anchor);
      return;
    } catch {
      // fall through to MMKV/Room fast-path
    }

    // No active session — show MMKV totals immediately (fast path), then
    // hydrate MMKV from Room (authoritative completed totals) in the background.
    setIsTracking(false);
    setTrackingMode('idle');
    setDebugNativeRunning(false);
    anchorRef.current = null;
    stopUiTick();

    const mmkvDistance = fastStorage.getTodayDistance();
    const mmkvElapsed = fastStorage.getTodayElapsed();
    const mmkvGoalsReached = fastStorage.getGoalsReached();

    setTodayProgress(prev => {
      if (isNewDay) {
        return {
          distanceMeters: mmkvDistance,
          elapsedSeconds: mmkvElapsed,
          goalReached: mmkvGoalsReached,
        };
      }

      const nextDistance = Math.max(prev.distanceMeters, mmkvDistance);
      const nextElapsed = Math.max(prev.elapsedSeconds, mmkvElapsed);
      const nextGoal = prev.goalReached || mmkvGoalsReached;

      if (
        prev.distanceMeters === nextDistance &&
        prev.elapsedSeconds === nextElapsed &&
        prev.goalReached === nextGoal
      ) {
        return prev;
      }

      return {
        distanceMeters: nextDistance,
        elapsedSeconds: nextElapsed,
        goalReached: nextGoal,
      };
    });

    try {
      const daily = await Tracking.getDailyTotalNative();
      if (!daily) return;

      // Room totals are authoritative for completed sessions, but can lag slightly
      // behind MMKV projections. Never decrease what the user sees on Home.
      const mergedDistance = Math.max(mmkvDistance, daily.distanceMeters);
      const mergedElapsed = Math.max(mmkvElapsed, daily.elapsedSeconds);
      const mergedGoalsReached = mmkvGoalsReached || daily.goalsReached;

      fastStorage.setTodayDistance(mergedDistance);
      fastStorage.setTodayElapsed(mergedElapsed);
      fastStorage.setGoalsReached(mergedGoalsReached);

      setTodayProgress(prev => {
        if (isNewDay) {
          return {
            distanceMeters: mergedDistance,
            elapsedSeconds: mergedElapsed,
            goalReached: mergedGoalsReached,
          };
        }

        const nextDistance = Math.max(prev.distanceMeters, mergedDistance);
        const nextElapsed = Math.max(prev.elapsedSeconds, mergedElapsed);
        const nextGoal = prev.goalReached || mergedGoalsReached;

        if (
          prev.distanceMeters === nextDistance &&
          prev.elapsedSeconds === nextElapsed &&
          prev.goalReached === nextGoal
        ) {
          return prev;
        }

        return {
          distanceMeters: nextDistance,
          elapsedSeconds: nextElapsed,
          goalReached: nextGoal,
        };
      });
    } catch {
      // best-effort
    }
  }, [applyAnchor, stopUiTick]);

  const schedulePostStopSync = useCallback(
    (delayMs: number = STOP_GRACE_MS) => {
      clearPostStopSync();
      postStopSyncTimeoutRef.current = setTimeout(() => {
        syncFromNativeService().catch(() => {});
      }, delayMs);
    },
    [STOP_GRACE_MS, clearPostStopSync, syncFromNativeService],
  );

  // On mount: restore state from running service
  useEffect(() => {
    syncFromNativeService();
  }, [syncFromNativeService]);

  // On app foreground resume: re-sync in case the native service state changed
  // while the JS layer was suspended (background → foreground transition).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      appStateRef.current = state;
      if (state === 'active') {
        syncFromNativeService();
        ensureUiTick();
      } else {
        stopUiTick();
      }
    });
    return () => sub.remove();
  }, [ensureUiTick, stopUiTick, syncFromNativeService]);

  // Subscribe to native anchor snapshots once on mount
  useEffect(() => {
    progressSub.current = Tracking.onAnchor(a => {
      applyAnchor(a);
    });
    return () => {
      progressSub.current?.remove();
      progressSub.current = null;
    };
  }, [applyAnchor]);

  // Low-frequency resync while active + tracking to correct any drift.
  useEffect(() => {
    const interval = setInterval(() => {
      if (appStateRef.current !== 'active') return;
      if (!trackingStarted.current) return;
      syncFromNativeService().catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [syncFromNativeService]);

  // Listen for native tracking start events (e.g., from auto-start via MotionTrackingBridge)
  useEffect(() => {
    const sub = Tracking.onTrackingStarted(() => {
      // Always update state on this event — it's the authoritative signal that a new
      // GPS session has started.
      trackingStarted.current = true;
      setIsTracking(true);
      setTrackingMode('auto');
      setDebugNativeRunning(true);

      // Do not reset today totals to zero; native/MMKV already track today's totals.
      syncFromNativeService().catch(() => {});
    });
    return () => sub?.remove();
  }, [syncFromNativeService]);

  // Listen for native tracking stopped events.
  // After TrackingService stops, MMKV holds the canonical day total (including the session
  // that just ended). Refresh UI from MMKV after a short grace period.
  useEffect(() => {
    const sub = Tracking.onTrackingStopped(() => {
      trackingStarted.current = false;
      setIsTracking(false);
      setTrackingMode('idle');
      setDebugNativeRunning(false);

      stopUiTick();
      anchorRef.current = null;

      // Allow a short grace period for native -> MMKV projection, then
      // re-sync from native/MMKV/Room so Home never briefly shows 0.
      schedulePostStopSync();
    });
    return () => sub?.remove();
  }, [schedulePostStopSync, stopUiTick]);

  // NOTE: Do not interpolate elapsed time in JS.
  // Instead, JS displays a foreground-only 1Hz timer derived from native "anchor" snapshots.
  // Native remains the source of truth for both the baseline totals and whether ticking
  // is allowed (manual always; auto only when AR + motion gates are active).

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

      // Start a session using canonical units. Notification goals are driven
      // exclusively by the aggregated-plan MMKV keys (set above).
      if (goals.hasDistanceGoal) {
        await Tracking.startTracking(
          'distance',
          goals.totalDistanceMeters,
          'm',
        );
      } else if (goals.hasTimeGoal) {
        await Tracking.startTracking('time', goals.totalTimeSeconds, 's');
      } else {
        // Permanent-only plans: allow a session without setting any goal.
        await Tracking.startTracking('distance', 0, 'm');
      }

      trackingStarted.current = true;
      setIsTracking(true);
      setTrackingMode(mode);
      setDebugNativeRunning(true);

      // Keep existing totals until native progress arrives.
      syncFromNativeService().catch(() => {});
    },
    [activePlans, goals, syncFromNativeService],
  );

  // Auto-stop when all goals reached
  useEffect(() => {
    if (allGoalsReached && isTracking) {
      Tracking.stopTracking();
      setIsTracking(false);
      setTrackingMode('idle');
      trackingStarted.current = false;
      setDebugNativeRunning(false);

      stopUiTick();
      anchorRef.current = null;
      schedulePostStopSync();
    }
  }, [allGoalsReached, isTracking, schedulePostStopSync, stopUiTick]);

  const stop = useCallback(async () => {
    stopUiTick();
    anchorRef.current = null;

    // Immediately freeze UI in idle state; a post-stop sync will refresh totals.
    setIsTracking(false);
    setTrackingMode('idle');
    trackingStarted.current = false;
    setDebugNativeRunning(false);

    await Tracking.stopTracking();
    // Read authoritative completed-today totals from MMKV (fastStorage) rather
    // than adding the session distance locally. This avoids double-counting
    // when native also persisted the same deltas to MMKV on stop.
    // Wait a short grace period to allow native -> MMKV sync to complete.
    schedulePostStopSync();
  }, [schedulePostStopSync, stopUiTick]);

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
      motionStateChangedSub.current?.remove();
      motionStateUpdateSub.current?.remove();
      motionStateChangedSub.current = null;
      motionStateUpdateSub.current = null;
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
  // React Native subscribes to MotionStateChanged (single source of truth) and
  // MotionStateUpdate (live debug sensor readings).
  useEffect(() => {
    if (!backgroundTrackingEnabled) {
      setDebugMotionState('UNKNOWN');
      setDebugMotionActivity('unknown');
      setDebugCurrentActivity('unknown');
      setDebugStepDetected(false);
      setDebugGpsActive(false);
      setDebugVariance(0);
      setDebugCadence(0);
      return;
    }

    motionStateChangedSub.current = MotionTracker.onMotionStateChanged(
      (event: MotionStateChangedEvent) => {
        setDebugMotionState(event.state);
        setDebugMotionActivity(event.activityType);
        // Only consider MotionStateChanged as authoritative for starting/stopping
        // when the native side explicitly signalled TrackingService. Otherwise
        // treat these events as debug-only and rely on Tracking.onTrackingStarted
        // / onTrackingStopped or the Tracking.getTrackingAnchor() snapshot for authoritative state.
        if (event.state === 'MOVING' && event.trackingSignalled) {
          // TrackingService auto-started via MotionTrackingBridge natively.
          // Update JS isTracking state if not already set.
          if (!trackingStarted.current) {
            trackingStarted.current = true;
            setIsTracking(true);
            setTrackingMode('auto');
            setDebugNativeRunning(true);
          }

          // Ensure we sync immediately with native TrackingService to pick up
          // any progress/delta that might have started in native code.
          syncFromNativeService().catch(() => {});
        } else if (event.state === 'IDLE') {
          // The authoritative stop event comes from Tracking.onTrackingStopped.
          // Keep the debug flag for sensor/GPS activity but do not flip isTracking
          // here — wait for the Tracking service event or MMKV poll.
          setDebugNativeRunning(false);
        }
      },
    );

    motionStateUpdateSub.current = MotionTracker.onMotionStateUpdate(update => {
      setDebugCurrentActivity(update.activity);
      setDebugStepDetected(update.stepDetected);
      setDebugGpsActive(update.gpsActive);
      setDebugVariance(update.variance);
      setDebugCadence(update.cadence);
    });

    // Fetch current state immediately — native addListener() also emits a replay
    // event, but this covers the case where it fires before the subscription is active.
    MotionTracker.getState()
      .then(s => {
        setDebugMotionState(s.state);
        setDebugMotionActivity(s.activityType);
      })
      .catch(() => {
        // Non-critical; event-driven updates will correct state shortly
      });

    return () => {
      motionStateChangedSub.current?.remove();
      motionStateUpdateSub.current?.remove();
      motionStateChangedSub.current = null;
      motionStateUpdateSub.current = null;
    };
  }, [backgroundTrackingEnabled, syncFromNativeService]);

  const debugInfo = useMemo<DebugInfo>(
    () => ({
      motionState: debugMotionState,
      motionActivity: debugMotionActivity,
      motionServiceRunning: debugMotionServiceRunning,
      nativeServiceRunning: debugNativeRunning,
      currentActivity: debugCurrentActivity,
      stepDetected: debugStepDetected,
      gpsActive: debugGpsActive,
      variance: debugVariance,
      cadence: debugCadence,
    }),
    [
      debugMotionState,
      debugMotionActivity,
      debugMotionServiceRunning,
      debugNativeRunning,
      debugCurrentActivity,
      debugStepDetected,
      debugGpsActive,
      debugVariance,
      debugCadence,
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
