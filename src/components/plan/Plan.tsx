import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PlanBlockList } from './PlanBlockList';
import { PlanCriteria } from './PlanCriteria';
import type { CriteriaState } from './PlanCriteria';
import { PlanDays } from './PlanDays';
import { PlanDayRange } from './PlanDayRange';
import { type AppItem } from '../../screens/BlocklistScreen';
import { spacing } from '../../theme';
import { DayKey, DurationType, DistanceUnit, BlockingPlan } from '../../types';
import { generateUUID } from '../../utils';

export interface PlanProps {
  plan: BlockingPlan | null;
  blockedApps: AppItem[];
  onEditApps: () => void;
  onPlanChange: (plan: BlockingPlan | null) => void;
}

function buildPlan(
  blockedApps: AppItem[],
  criteria: CriteriaState,
  days: DayKey[],
  durationType: DurationType,
  from: string,
  to: string,
): BlockingPlan | null {
  if (blockedApps.length === 0 || criteria.type === null || days.length === 0) {
    return null;
  }

  const planCriteria: BlockingPlan['criteria'] =
    criteria.type === 'distance'
      ? {
          type: 'distance',
          value: criteria.value.distance,
          unit: criteria.unit,
        }
      : criteria.type === 'time'
      ? { type: 'time', value: criteria.value.time }
      : { type: 'permanent' };

  return {
    id: generateUUID(),
    days,
    duration:
      durationType === 'entire_day'
        ? { type: 'entire_day' }
        : { type: 'specific_hours', from, to },
    criteria: planCriteria,
    blockedApps: blockedApps.map(app => ({
      id: app.id,
      name: app.name,
      icon: app.icon,
    })),
  };
}

export const Plan = ({
  plan,
  blockedApps,
  onEditApps,
  onPlanChange,
}: PlanProps) => {
  const [days, setDays] = useState<DayKey[]>(
    plan?.days ?? ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  );

  const [durationType, setDurationType] = useState<DurationType>(
    plan?.duration.type ?? 'entire_day',
  );
  const [from, setFrom] = useState(
    (plan?.duration.type === 'specific_hours'
      ? plan.duration.from
      : undefined) ?? '09:00 AM',
  );
  const [to, setTo] = useState(
    (plan?.duration.type === 'specific_hours' ? plan.duration.to : undefined) ??
      '05:00 PM',
  );

  const [criteria, setCriteria] = useState<CriteriaState>({
    type: plan?.criteria.type ?? null,
    unit: ((plan?.criteria.type === 'distance'
      ? plan.criteria.unit
      : undefined) ?? 'km') as DistanceUnit,
    value: {
      distance: plan?.criteria.type === 'distance' ? plan.criteria.value : 5.0,
      time: plan?.criteria.type === 'time' ? plan.criteria.value : 30,
    },
  });

  useEffect(() => {
    onPlanChange(
      buildPlan(blockedApps, criteria, days, durationType, from, to),
    );
  }, [blockedApps, criteria, days, durationType, from, to, onPlanChange]);

  return (
    <View style={styles.container}>
      <PlanBlockList apps={blockedApps} onEdit={onEditApps} />
      <PlanCriteria criteria={criteria} onCriteriaChange={setCriteria} />
      <PlanDays days={days} onDaysChange={setDays} />
      <PlanDayRange
        range={{ durationType, from, to }}
        onRangeChange={r => {
          setDurationType(r.durationType);
          setFrom(r.from);
          setTo(r.to);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
});
