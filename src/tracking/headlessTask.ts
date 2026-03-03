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
    const planDate = todayYyyyMmDd();
    try {
      fastStorage.setPlanActiveToday(false);
      fastStorage.setPlanDay(planDate);
      await Tracking.writePlanDayActivity(false, planDate);
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

  const goals = aggregateGoals(activePlans);

  // Keep native notification in sync even when the UI process is not running.
  try {
    const planDate = todayYyyyMmDd();
    fastStorage.setPlanActiveToday(true);
    fastStorage.setPlanDay(planDate);
    await Tracking.writePlanDayActivity(true, planDate);

    if (goals.hasDistanceGoal && goals.hasTimeGoal) {
      fastStorage.setGoalDistance(goals.totalDistanceMeters, 'm');
      fastStorage.setGoalTime(goals.totalTimeSeconds, 's');
      fastStorage.setGoal('distance', goals.totalDistanceMeters, 'm');
    } else if (goals.hasDistanceGoal) {
      fastStorage.setGoal('distance', goals.totalDistanceMeters, 'm');
      fastStorage.setGoalDistance(goals.totalDistanceMeters, 'm');
      fastStorage.setGoalTime(0, 's');
    } else if (goals.hasTimeGoal) {
      fastStorage.setGoal('time', goals.totalTimeSeconds, 's');
      fastStorage.setGoalDistance(0, 'm');
      fastStorage.setGoalTime(goals.totalTimeSeconds, 's');
    } else {
      fastStorage.setGoal('none', 0, '');
      fastStorage.setGoalDistance(0, 'm');
      fastStorage.setGoalTime(0, 's');
    }
  } catch {
    // best-effort
  }

  try {
    if (goals.hasDistanceGoal) {
      console.log(
        `[HeadlessTask] Starting distance tracking with active goal total: ${goals.totalDistanceMeters}m.`,
      );
      await Tracking.startTracking('distance', goals.totalDistanceMeters, 'm');
    } else if (goals.hasTimeGoal) {
      console.log(
        `[HeadlessTask] Starting time tracking with active goal total: ${goals.totalTimeSeconds}s.`,
      );
      await Tracking.startTracking('time', goals.totalTimeSeconds, 's');
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
