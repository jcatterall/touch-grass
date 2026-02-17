import { AppRegistry } from 'react-native';
import { storage } from '../storage';
import { findActivePlansForToday } from '../hooks/useTracking';
import { Tracking } from './Tracking';
import { TrackingPermissions } from './Permissions';

interface TaskData {
  activity: string;
  transition: string;
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
  if (activity !== 'WALKING' && activity !== 'RUNNING' && activity !== 'CYCLING') {
    console.log(`[HeadlessTask] Ignoring ignorable activity: ${activity}.`);
    return;
  }

  console.log('[HeadlessTask] Checking permissions...');
  const hasPerms = await TrackingPermissions.checkAll();
  if (!hasPerms) {
    console.error(
      '[HeadlessTask] FAILED: Permissions check failed. Aborting.',
    );
    return;
  }
  console.log('[HeadlessTask] Permissions check passed.');

  console.log('[HeadlessTask] Loading plans from storage...');
  const plans = await storage.getPlans();
  console.log(`[HeadlessTask] Found ${plans.length} total plans.`);

  const activePlans = findActivePlansForToday(plans);
  if (activePlans.length === 0) {
    console.error(
      '[HeadlessTask] FAILED: No active plans for today. Aborting.',
    );
    return;
  }
  console.log(
    `[HeadlessTask] Found ${activePlans.length} active plans for today.`,
  );

  try {
    console.log('[HeadlessTask] Calling Tracking.startTracking...');
    await Tracking.startTracking('distance', 999, 'km');
    console.log('[HeadlessTask] SUCCEEDED: Tracking.startTracking called.');
  } catch (e) {
    console.error('[HeadlessTask] FAILED: Tracking.startTracking threw an error.', e);
  }
}

AppRegistry.registerHeadlessTask(
  'TouchGrassActivityTask',
  () => activityTask,
);