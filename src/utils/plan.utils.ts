import { BlockingPlan, DAYS } from '../types';

export function getScheduleDaysText(plan: BlockingPlan) {
  return plan.days
    .map(x => DAYS.find(d => d.key === x)?.label)
    .filter(Boolean)
    .join(', ');
}

export function getActiveScheduleTimeText(plan: BlockingPlan) {
  return plan.duration.type === 'entire_day'
    ? 'All day'
    : `${plan.duration.from} to ${plan.duration.to}`;
}
