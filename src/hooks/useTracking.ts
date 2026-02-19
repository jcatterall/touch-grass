import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DeviceEventEmitter, EmitterSubscription } from 'react-native';
import { storage, fastStorage, PLANS_CHANGED_EVENT } from '../storage';
import { BlockingPlan, DayKey } from '../types';
import {
  ActivityRecognition,
  ActivityDetectedEvent,
} from '../native/ActivityRecognition';
import { Tracking, TrackingProgress } from '../native/Tracking';
import { TrackingPermissions } from '../native/Permissions';
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

export function findActivePlansForToday(
  plans: BlockingPlan[],
): BlockingPlan[] {
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
  lastTransition: string;
  actRecogRegistered: boolean;
  nativeServiceRunning: boolean;
  sessionDistance: number;
  sessionTime: number;
  baselineDistance: number;
  baselineTime: number;
  startTrackingBlocked: string | null;
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

  // dailyBaseline holds the accumulated activity from previous sessions today.
  // Initialised synchronously from MMKV (zero-latency mmap read) so the UI
  // shows the correct value on the very first render — no async "calculating..." state.
  const [dailyBaseline, setDailyBaseline] = useState<TrackingProgress>(() => ({
    distanceMeters: fastStorage.getTodayDistance(),
    elapsedSeconds: fastStorage.getTodayElapsed(),
    goalReached: fastStorage.getGoalsReached(),
  }));

  // sessionProgress holds the current active session's progress
  const [sessionProgress, setSessionProgress] = useState<TrackingProgress>({
    distanceMeters: 0,
    elapsedSeconds: 0,
    goalReached: false,
  });

  const [activePlans, setActivePlans] = useState<BlockingPlan[]>([]);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] =
    useState(false);

  const [debugLastTransition, setDebugLastTransition] = useState('none');
  const [debugActRecogRegistered, setDebugActRecogRegistered] = useState(false);
  const [debugNativeRunning, setDebugNativeRunning] = useState(false);
  const [debugStartBlocked, setDebugStartBlocked] = useState<string | null>(
    null,
  );

  const progressSub = useRef<EmitterSubscription | null>(null);
  const transitionSub = useRef<EmitterSubscription | null>(null);
  const trackingStarted = useRef(false);

  // Time interpolation: store the last native update so we can tick every second
  const lastNativeUpdate = useRef<{
    elapsedSeconds: number;
    distanceMeters: number;
    goalReached: boolean;
    timestamp: number;
  } | null>(null);

  const goals = useMemo(() => aggregateGoals(activePlans), [activePlans]);

  // Combined progress = daily baseline + current session
  const progress = useMemo<TrackingProgress>(
    () => ({
      distanceMeters:
        dailyBaseline.distanceMeters + sessionProgress.distanceMeters,
      elapsedSeconds:
        dailyBaseline.elapsedSeconds + sessionProgress.elapsedSeconds,
      goalReached: sessionProgress.goalReached,
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
  // Only block apps from plans whose individual goal is NOT yet met.
  // Runs on a 15-second interval rather than on every progress tick
  // to avoid excessive native bridge calls and storage reads.
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

      // Filter to plans whose goal is not yet reached
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

      await AppBlocker.updateBlockerConfig(blockedPackages, false, hasPermanent);
      await AppBlocker.startBlocker();
    };

    syncBlocker();
    const interval = setInterval(syncBlocker, 15_000);
    return () => clearInterval(interval);
  }, [activePlans]);

  // Check permissions + load background tracking state on mount
  useEffect(() => {
    TrackingPermissions.checkAll().then(setPermissionsGranted);
    storage.getBackgroundTrackingEnabled().then(setBackgroundTrackingEnabled);
  }, []);

  // On mount: recover unsaved sessions and restore active tracking state.
  // The daily baseline is already populated synchronously from MMKV above.
  // This effect only handles two edge cases:
  //   1. A pure-background headless session that completed before MMKV was in place
  //      (SharedPreferences fallback, kept for backward compat — only applied when
  //      MMKV has no data, i.e. pre-upgrade device. If MMKV has data, the service
  //      already wrote there and adding SharedPreferences on top causes double-counting.)
  //   2. Re-opening the app while the native service is still running mid-session.
  useEffect(() => {
    const recover = async () => {
      // Backward-compat: only use SharedPreferences session if MMKV has no data yet.
      // MMKV is written by TrackingService on every GPS fix, so it's always current
      // for devices that have run the upgraded app at least once.
      const mmkvHasData =
        fastStorage.getTodayDistance() > 0 || fastStorage.getTodayElapsed() > 0;
      if (!mmkvHasData) {
        const unsaved = await Tracking.getUnsavedSession();
        if (unsaved) {
          await storage.saveDailyActivity(
            unsaved.distanceMeters,
            unsaved.elapsedSeconds,
            unsaved.goalsReached,
          );
          setDailyBaseline(prev => ({
            distanceMeters: prev.distanceMeters + unsaved.distanceMeters,
            elapsedSeconds: prev.elapsedSeconds + unsaved.elapsedSeconds,
            goalReached: prev.goalReached || unsaved.goalsReached,
          }));
        }
      }

      // Restore active session if the native service is still running
      const current = await Tracking.getProgress();
      if (current.distanceMeters > 0 || current.elapsedSeconds > 0) {
        setSessionProgress(current);
        setIsTracking(true);
        setTrackingMode('auto'); // assume auto if recovered from background
        trackingStarted.current = true;
        lastNativeUpdate.current = {
          elapsedSeconds: current.elapsedSeconds,
          distanceMeters: current.distanceMeters,
          goalReached: current.goalReached,
          timestamp: Date.now(),
        };
      }
    };
    recover();
  }, []);

  // Subscribe to progress events once on mount
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

  // Listen for native tracking start events (e.g., from headless task)
  useEffect(() => {
    const sub = Tracking.onTrackingStarted(() => {
      // trackingStarted ref prevents this from running if start was initiated by the UI
      if (!trackingStarted.current) {
        console.log('[useTracking] Received native onTrackingStarted event, syncing UI.');
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
    });

    return () => sub?.remove();
  }, []);


  // 1-second interval to interpolate elapsed time between native updates.
  // Always runs when tracking so the time display ticks smoothly.
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


  // Start tracking — uses a large goal for the native service
  // so JS handles the aggregated goal-reached logic
  const startTracking = useCallback(
    async (mode: TrackingMode) => {
      if (trackingStarted.current) {
        setDebugStartBlocked('trackingStarted.current=true');
        return;
      }
      if (activePlans.length === 0) {
        setDebugStartBlocked('activePlans.length=0');
        return;
      }

      const hasPerms = await TrackingPermissions.checkAll();
      if (!hasPerms) {
        const granted = await TrackingPermissions.requestAll();
        setPermissionsGranted(granted);
        if (!granted) {
          setDebugStartBlocked('permissions denied');
          return;
        }
      }

      setDebugStartBlocked(null);
      await Tracking.startTracking('distance', 999, 'km');

      trackingStarted.current = true;
      // Seed immediately so the 1-second interpolation timer starts ticking
      // without waiting for the first native GPS callback
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

  // Persist current session to daily log and update baseline
  const saveAndResetSession = useCallback(async () => {
    if (
      sessionProgress.distanceMeters === 0 &&
      sessionProgress.elapsedSeconds === 0
    )
      return;

    await storage.saveDailyActivity(
      sessionProgress.distanceMeters,
      sessionProgress.elapsedSeconds,
      allGoalsReached,
    );

    // Move session progress into baseline so UI stays cumulative
    setDailyBaseline(prev => ({
      distanceMeters: prev.distanceMeters + sessionProgress.distanceMeters,
      elapsedSeconds: prev.elapsedSeconds + sessionProgress.elapsedSeconds,
      goalReached: prev.goalReached || allGoalsReached,
    }));
    setSessionProgress({
      distanceMeters: 0,
      elapsedSeconds: 0,
      goalReached: false,
    });
  }, [sessionProgress, allGoalsReached]);

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

  // Stop tracking
  const stop = useCallback(async () => {
    // Snap to the last native values before stopping — the interpolated
    // JS time drifts slightly, so use the ground-truth from the service
    const nativeProgress = await Tracking.getProgress();
    if (nativeProgress.distanceMeters > 0 || nativeProgress.elapsedSeconds > 0) {
      setSessionProgress(nativeProgress);
    }

    await Tracking.stopTracking();
    setIsTracking(false);
    setTrackingMode('idle');
    trackingStarted.current = false;
    lastNativeUpdate.current = null;
    setDebugNativeRunning(false);

    // Save using the snapped native values
    const dist = nativeProgress.distanceMeters || sessionProgress.distanceMeters;
    const time = nativeProgress.elapsedSeconds || sessionProgress.elapsedSeconds;
    if (dist > 0 || time > 0) {
      await storage.saveDailyActivity(dist, time, allGoalsReached);
      setDailyBaseline(prev => ({
        distanceMeters: prev.distanceMeters + dist,
        elapsedSeconds: prev.elapsedSeconds + time,
        goalReached: prev.goalReached || allGoalsReached,
      }));
      setSessionProgress({
        distanceMeters: 0,
        elapsedSeconds: 0,
        goalReached: false,
      });
    }
  }, [sessionProgress, allGoalsReached]);

  // Manual start — blocked while auto-tracking is active (QA spec conflict resolution)
  const startManual = useCallback(async () => {
    if (trackingMode === 'auto' && isTracking) {
      setDebugStartBlocked('auto_tracking_active');
      return;
    }
    await startTracking('manual');
  }, [trackingMode, isTracking, startTracking]);

  // Toggle background tracking.
  // Enabling starts TrackingService in IDLE state (foreground, GPS off) so it can
  // receive motion signals directly from ActivityUpdateReceiver without any
  // startForegroundService() call from a BroadcastReceiver (which fails on Android 8+).
  const toggleBackgroundTracking = useCallback(async () => {
    if (backgroundTrackingEnabled) {
      // Turning off — stop activity recognition and the idle service
      await ActivityRecognition.stop().catch(() => {});
      await Tracking.stopIdleService().catch(() => {});
      await storage.setBackgroundTrackingEnabled(false);
      setBackgroundTrackingEnabled(false);
    } else {
      // Turning on — request permissions first, then start idle service + activity recognition
      const granted = await TrackingPermissions.requestAll();
      setPermissionsGranted(granted);
      if (!granted) return;

      await Tracking.startIdleService().catch(() => {});
      await ActivityRecognition.start().catch(() => {});
      await storage.setBackgroundTrackingEnabled(true);
      setBackgroundTrackingEnabled(true);
    }
  }, [backgroundTrackingEnabled]);

  // Set up activity recognition for passive detection when background tracking is enabled.
  // Uses polling-based detection — receives periodic updates with confidence scores.
  useEffect(() => {
    if (!backgroundTrackingEnabled || activePlans.length === 0) {
      setDebugActRecogRegistered(false);
      return;
    }

    const handleActivity = (event: ActivityDetectedEvent) => {
      const ts = new Date().toLocaleTimeString();
      setDebugLastTransition(`${event.activity} ${event.confidence}% @ ${ts}`);

      if (
        event.activity === 'WALKING' ||
        event.activity === 'RUNNING' ||
        event.activity === 'CYCLING'
      ) {
        // STILL → MOVING: native TrackingService cancels the 120s stationary buffer
        // via ACTION_MOTION_DETECTED. JS just needs to start/continue the session.
        startTracking('auto');
      }
      // STILL: handled entirely by the native 120s stationary buffer in TrackingService.
      // The service shuts itself down and onDestroy fires, which will cause the
      // onTrackingStarted / getProgress recovery path to see isTracking=false next open.
    };

    transitionSub.current =
      ActivityRecognition.onActivityDetected(handleActivity);
    ActivityRecognition.start()
      .then(() => setDebugActRecogRegistered(true))
      .catch(() => setDebugActRecogRegistered(false));

    return () => {
      transitionSub.current?.remove();
      transitionSub.current = null;
      setDebugActRecogRegistered(false);
    };
  }, [backgroundTrackingEnabled, activePlans, startTracking]);

  const debugInfo = useMemo<DebugInfo>(
    () => ({
      lastTransition: debugLastTransition,
      actRecogRegistered: debugActRecogRegistered,
      nativeServiceRunning: debugNativeRunning,
      sessionDistance: sessionProgress.distanceMeters,
      sessionTime: sessionProgress.elapsedSeconds,
      baselineDistance: dailyBaseline.distanceMeters,
      baselineTime: dailyBaseline.elapsedSeconds,
      startTrackingBlocked: debugStartBlocked,
    }),
    [
      debugLastTransition,
      debugActRecogRegistered,
      debugNativeRunning,
      sessionProgress,
      dailyBaseline,
      debugStartBlocked,
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
