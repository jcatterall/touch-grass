import { AppRegistry } from 'react-native';
import { storage } from '../storage';
import { BlockingPlan, DayKey } from '../types';
import { Tracking } from './Tracking';
import { TrackingPermissions } from './Permissions';

const DAY_MAP: Record<number, DayKey> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

function findActivePlanForToday(plans: BlockingPlan[]): BlockingPlan | null {
  const today = DAY_MAP[new Date().getDay()];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    plans.find(plan => {
      if (!plan.active) return false;
      if (!plan.days.includes(today)) return false;
      if (plan.criteria.type === 'permanent') return false;

      if (plan.duration.type === 'specific_hours') {
        const [fromH, fromM] = plan.duration.from.split(':').map(Number);
        const [toH, toM] = plan.duration.to.split(':').map(Number);
        const fromMinutes = fromH * 60 + fromM;
        const toMinutes = toH * 60 + toM;
        if (currentMinutes < fromMinutes || currentMinutes > toMinutes) {
          return false;
        }
      }

      return true;
    }) ?? null
  );
}

interface TaskData {
  activity: string;
  transition: string;
}

async function activityTask(data: TaskData): Promise<void> {
  const { activity, transition } = data;

  // Only start tracking on ENTER transitions for walking/running
  if (transition !== 'ENTER') return;
  if (activity !== 'WALKING' && activity !== 'RUNNING') return;

  // Check permissions first
  const hasPerms = await TrackingPermissions.checkAll();
  if (!hasPerms) return;

  // Find an active plan for today
  const plans = await storage.getPlans();
  const plan = findActivePlanForToday(plans);
  if (!plan) return;

  const { criteria } = plan;
  if (criteria.type === 'permanent') return;

  const goalType = criteria.type;
  const goalValue = criteria.value;
  const goalUnit = criteria.type === 'distance' ? criteria.unit : 'min';

  await Tracking.startTracking(goalType, goalValue, goalUnit);
}

AppRegistry.registerHeadlessTask(
  'TouchGrassActivityTask',
  () => activityTask,
);
