import { AppRegistry } from 'react-native';
import { storage, fastStorage } from '../storage';
import { findActivePlansForToday, aggregateGoals } from '../hooks/useTracking';
import { Tracking } from './Tracking';
import { TrackingPermissions } from './Permissions';

interface TaskData {
  activity: string;
  transition: string;
}

function todayYyyyMmDd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// NOTE: console.log messages in a headless task are visible in Logcat
async function activityTask(data: TaskData): Promise<void> {
  const { activity, transition } = data;
  console.log(
    `[HeadlessTask] Received activity: ${activity}, transition: ${transition}`,
  );

  if (transition !== 'ENTER') {
    console.log('[HeadlessTask] Ignoring non-ENTER transition.');
    return;
  }
  if (
    activity !== 'WALKING' &&
    activity !== 'RUNNING' &&
    activity !== 'CYCLING'
  ) {
    console.log(`[HeadlessTask] Ignoring ignorable activity: ${activity}.`);
    return;
  }

  console.log('[HeadlessTask] Checking permissions...');
  const hasPerms = await TrackingPermissions.checkAll();
  if (!hasPerms) {
    console.error('[HeadlessTask] FAILED: Permissions check failed. Aborting.');
    return;
  }
  console.log('[HeadlessTask] Permissions check passed.');

  console.log('[HeadlessTask] Loading plans from storage...');
  const plans = await storage.getPlans();
  console.log(`[HeadlessTask] Found ${plans.length} total plans.`);

  const activePlans = findActivePlansForToday(plans);
  if (activePlans.length === 0) {
    try {
      fastStorage.setPlanActiveToday(false);
      fastStorage.setPlanDay('');
    } catch {
      // best-effort
    }
    console.error(
      '[HeadlessTask] FAILED: No active plans for today. Aborting.',
    );
    return;
  }
  console.log(
    `[HeadlessTask] Found ${activePlans.length} active plans for today.`,
  );

  // Read today's already-completed activity so we pass the REMAINING goal to the
  // native service. This lets TrackingService stop itself when the goal is reached,
  // even while the app stays closed.
  // Primary: Room (native SQLite) — faster cold-start, no AsyncStorage bridge overhead.
  // Fallback: AsyncStorage — used on first install before Room has any data.
  let todayDistanceMeters = 0;
  let todayElapsedSeconds = 0;
  try {
    const nativeTotal = await Tracking.getDailyTotalNative();
    if (nativeTotal) {
      todayDistanceMeters = nativeTotal.distanceMeters;
      todayElapsedSeconds = nativeTotal.elapsedSeconds;
      console.log(
        `[HeadlessTask] Today from Room: dist=${todayDistanceMeters}m elapsed=${todayElapsedSeconds}s`,
      );
    } else {
      const asyncTotal = await storage.getTodayActivity();
      todayDistanceMeters = asyncTotal.distanceMeters;
      todayElapsedSeconds = asyncTotal.elapsedSeconds;
      console.log(
        `[HeadlessTask] Today from AsyncStorage: dist=${todayDistanceMeters}m elapsed=${todayElapsedSeconds}s`,
      );
    }
  } catch (e) {
    console.error(
      '[HeadlessTask] Failed to read today activity, using zero baseline.',
      e,
    );
  }

  const goals = aggregateGoals(activePlans);

  // Keep native notification in sync even when the UI process is not running.
  try {
    fastStorage.setPlanActiveToday(true);
    fastStorage.setPlanDay(todayYyyyMmDd());

    if (goals.hasDistanceGoal && goals.hasTimeGoal) {
      fastStorage.setGoalDistance(goals.totalDistanceMeters, 'm');
      fastStorage.setGoalTime(goals.totalTimeSeconds, 's');
      fastStorage.setGoal('distance', goals.totalDistanceMeters, 'm');
    } else if (goals.hasDistanceGoal) {
      fastStorage.setGoal('distance', goals.totalDistanceMeters, 'm');
    } else if (goals.hasTimeGoal) {
      fastStorage.setGoal('time', goals.totalTimeSeconds, 's');
    } else {
      fastStorage.setGoal('none', 0, '');
    }
  } catch {
    // best-effort
  }

  try {
    if (goals.hasDistanceGoal) {
      const remainingMeters = Math.max(
        0,
        goals.totalDistanceMeters - todayDistanceMeters,
      );
      if (remainingMeters <= 0) {
        console.log(
          '[HeadlessTask] Distance goal already met today. Aborting.',
        );
        return;
      }
      console.log(
        `[HeadlessTask] Starting distance tracking: ${remainingMeters}m remaining.`,
      );
      await Tracking.startTracking('distance', remainingMeters, 'm');
    } else if (goals.hasTimeGoal) {
      const remainingSeconds = Math.max(
        0,
        goals.totalTimeSeconds - todayElapsedSeconds,
      );
      if (remainingSeconds <= 0) {
        console.log('[HeadlessTask] Time goal already met today. Aborting.');
        return;
      }
      console.log(
        `[HeadlessTask] Starting time tracking: ${remainingSeconds}s remaining.`,
      );
      await Tracking.startTracking('time', remainingSeconds, 's');
    } else {
      console.log('[HeadlessTask] No trackable goal found. Aborting.');
      return;
    }
    console.log('[HeadlessTask] SUCCEEDED: Tracking.startTracking called.');
  } catch (e) {
    console.error(
      '[HeadlessTask] FAILED: Tracking.startTracking threw an error.',
      e,
    );
  }
}

AppRegistry.registerHeadlessTask('TouchGrassActivityTask', () => activityTask);
