import { useEffect, useRef, useState, useCallback } from 'react';
import { DeviceEventEmitter, EmitterSubscription } from 'react-native';
import { storage, PLANS_CHANGED_EVENT } from '../storage';
import { BlockingPlan, DayKey } from '../types';
import {
  ActivityRecognition,
  ActivityTransitionEvent,
} from '../native/ActivityRecognition';
import { Tracking, TrackingProgress } from '../native/Tracking';
import { TrackingPermissions } from '../native/Permissions';

const DAY_MAP: Record<number, DayKey> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

function getTodayKey(): DayKey {
  return DAY_MAP[new Date().getDay()];
}

function isWithinDuration(plan: BlockingPlan): boolean {
  if (plan.duration.type === 'entire_day') return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [fromH, fromM] = plan.duration.from.split(':').map(Number);
  const [toH, toM] = plan.duration.to.split(':').map(Number);

  const fromMinutes = fromH * 60 + fromM;
  const toMinutes = toH * 60 + toM;

  return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
}

function findActivePlanForToday(
  plans: BlockingPlan[],
): BlockingPlan | null {
  const today = getTodayKey();

  return (
    plans.find(
      plan =>
        plan.active &&
        plan.days.includes(today) &&
        isWithinDuration(plan) &&
        (plan.criteria.type === 'distance' || plan.criteria.type === 'time'),
    ) ?? null
  );
}

export interface TrackingState {
  isTracking: boolean;
  progress: TrackingProgress;
  activePlan: BlockingPlan | null;
  permissionsGranted: boolean;
  startManual: () => Promise<void>;
  stop: () => Promise<void>;
}

export function useTracking(): TrackingState {
  const [isTracking, setIsTracking] = useState(false);
  const [progress, setProgress] = useState<TrackingProgress>({
    distanceMeters: 0,
    elapsedSeconds: 0,
    goalReached: false,
  });
  const [activePlan, setActivePlan] = useState<BlockingPlan | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  const subscriptions = useRef<EmitterSubscription[]>([]);
  const trackingStarted = useRef(false);

  // Load active plan
  useEffect(() => {
    const load = async () => {
      const plans = await storage.getPlans();
      const plan = findActivePlanForToday(plans);
      setActivePlan(plan);
    };
    load();

    // Re-load immediately when plans change
    const sub = DeviceEventEmitter.addListener(PLANS_CHANGED_EVENT, load);

    // Re-check every minute for time-window changes
    const interval = setInterval(load, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  // Check permissions on mount
  useEffect(() => {
    TrackingPermissions.checkAll().then(setPermissionsGranted);
  }, []);

  // Start tracking for a given plan
  const startTrackingForPlan = useCallback(
    async (plan: BlockingPlan) => {
      if (trackingStarted.current) return;

      const hasPerms = await TrackingPermissions.checkAll();
      if (!hasPerms) {
        const granted = await TrackingPermissions.requestAll();
        setPermissionsGranted(granted);
        if (!granted) return;
      }

      const { criteria } = plan;
      if (criteria.type === 'permanent') return;

      const goalType = criteria.type;
      const goalValue = criteria.value;
      const goalUnit = criteria.type === 'distance' ? criteria.unit : 'min';

      await Tracking.startTracking(goalType, goalValue, goalUnit);

      trackingStarted.current = true;
      setIsTracking(true);

      // Subscribe to progress updates
      const progressSub = Tracking.onProgress(p => {
        setProgress(p);
      });
      if (progressSub) subscriptions.current.push(progressSub);

      const goalSub = Tracking.onGoalReached(() => {
        setProgress(prev => ({ ...prev, goalReached: true }));
        setIsTracking(false);
        trackingStarted.current = false;
      });
      if (goalSub) subscriptions.current.push(goalSub);
    },
    [],
  );

  // Stop tracking
  const stop = useCallback(async () => {
    await Tracking.stopTracking();
    setIsTracking(false);
    trackingStarted.current = false;
    subscriptions.current.forEach(s => s.remove());
    subscriptions.current = [];
  }, []);

  // Manual start
  const startManual = useCallback(async () => {
    if (!activePlan) return;
    await startTrackingForPlan(activePlan);
  }, [activePlan, startTrackingForPlan]);

  // Set up activity recognition for passive detection
  useEffect(() => {
    if (!activePlan) return;

    const handleTransition = (event: ActivityTransitionEvent) => {
      if (
        (event.activity === 'WALKING' || event.activity === 'RUNNING') &&
        event.transition === 'ENTER'
      ) {
        startTrackingForPlan(activePlan);
      } else if (event.transition === 'EXIT' && !progress.goalReached) {
        // Don't stop if goal almost reached — let it continue
        // Only stop if very early (< 10% progress)
      }
    };

    const transitionSub = ActivityRecognition.onTransition(handleTransition);
    if (transitionSub) subscriptions.current.push(transitionSub);

    ActivityRecognition.start().catch(() => {});

    return () => {
      ActivityRecognition.stop().catch(() => {});
      subscriptions.current.forEach(s => s.remove());
      subscriptions.current = [];
    };
  }, [activePlan, startTrackingForPlan, progress.goalReached]);

  return {
    isTracking,
    progress,
    activePlan,
    permissionsGranted,
    startManual,
    stop,
  };
}
