import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import {
  Button,
  DayChip,
  SegmentedControl,
  Typography,
  TimeRangeSlider,
  AppBlockList,
} from '../../components';
import { BlocklistScreen, type AppItem } from '../BlocklistScreen';
import { spacing, colors } from '../../theme';
import { triggerHaptic } from '../../utils/haptics';
import {
  DayKey,
  DurationType,
  CriteriaType,
  DAYS,
  DistanceUnit,
  KM_TO_MI,
  MI_TO_KM,
  BlockingPlan,
} from '../../types';
import Slider from '../../components/Slider';

export interface PlanProps {
  onComplete: (plan: BlockingPlan) => void;
  plan: BlockingPlan | null;
}

const DISTANCE_CONFIG = {
  km: { min: 1, max: 15, step: 0.5, label: 'km' },
  mi: { min: 0.5, max: 10, step: 0.5, label: 'mi' },
} as const;

const CRITERIA_CONFIG = {
  distance: DISTANCE_CONFIG.km,
  time: { min: 5, max: 120, step: 5, label: 'min' },
} as const;

export const Plan = ({ onComplete, plan }: PlanProps) => {
  const [schedule, setSchedule] = useState({
    days: plan?.days ?? (['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayKey[]),
    durationType: (plan?.duration.type ?? 'specific_hours') as DurationType,
    from:
      (plan?.duration.type === 'specific_hours'
        ? plan.duration.from
        : undefined) ?? '09:00 AM',
    to:
      (plan?.duration.type === 'specific_hours'
        ? plan.duration.to
        : undefined) ?? '05:00 PM',
  });

  const [criteria, setCriteria] = useState({
    type: (plan?.criteria.type ?? 'distance') as CriteriaType,
    unit: ((plan?.criteria.type === 'distance'
      ? plan.criteria.unit
      : undefined) ?? 'km') as DistanceUnit,
    value: {
      distance: plan?.criteria.type === 'distance' ? plan.criteria.value : 5.0,
      time: plan?.criteria.type === 'time' ? plan.criteria.value : 30,
    },
  });

  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blockedApps, setBlockedApps] = useState<AppItem[]>(
    (plan?.blockedApps as unknown as AppItem[]) ?? [],
  );

  const config =
    criteria.type === 'distance'
      ? DISTANCE_CONFIG[criteria.unit]
      : CRITERIA_CONFIG.time;

  const currentValue = criteria.value[criteria.type];

  const toggleDay = (day: DayKey) => {
    triggerHaptic('selection');
    setSchedule(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day],
    }));
  };

  const handleUnitChange = (index: number) => {
    const newUnit = index === 0 ? 'mi' : 'km';
    if (newUnit === criteria.unit) return;

    const isKm = criteria.unit === 'km';
    const converted = isKm
      ? criteria.value.distance * KM_TO_MI
      : criteria.value.distance * MI_TO_KM;

    const limits = DISTANCE_CONFIG[newUnit];
    const clamped = Math.min(Math.max(converted, limits.min), limits.max);

    setCriteria(prev => ({
      ...prev,
      unit: newUnit,
      value: { ...prev.value, distance: Math.round(clamped * 2) / 2 },
    }));
  };

  const handleSavePlan = () => {
    triggerHaptic('impactMedium');
    const newPlan: BlockingPlan = {
      days: schedule.days,
      duration:
        schedule.durationType === 'entire_day'
          ? { type: 'entire_day' }
          : { type: 'specific_hours', from: schedule.from, to: schedule.to },
      criteria:
        criteria.type === 'distance'
          ? {
              type: 'distance',
              value: criteria.value.distance,
              unit: criteria.unit,
            }
          : { type: 'time', value: criteria.value.time },
      blockedApps: blockedApps.map(app => ({
        id: app.id,
        name: app.name,
        icon: app.icon,
      })),
    };
    onComplete(newPlan);
  };

  if (showBlocklist) {
    return (
      <BlocklistScreen
        selectedApps={blockedApps}
        onSave={apps => {
          setBlockedApps(apps);
          setShowBlocklist(false);
        }}
        onClose={() => setShowBlocklist(false)}
      />
    );
  }

  return (
    <OnboardingContainer>
      <View style={styles.container}>
        <Typography mode="dark" variant="title">
          {plan ? 'Edit plan' : 'Your plan'}
        </Typography>

        <View style={styles.section}>
          <Typography variant="body" color="inverse" style={styles.label}>
            Repeat
          </Typography>
          <View style={styles.row}>
            {DAYS.map(day => (
              <DayChip
                key={day.key}
                label={day.label}
                isSelected={schedule.days.includes(day.key)}
                onPress={() => toggleDay(day.key)}
                mode="dark"
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Typography variant="body" color="inverse" style={styles.label}>
              Range
            </Typography>
            <SegmentedControl
              options={['Entire Day', 'Specific Hours']}
              selectedIndex={schedule.durationType === 'entire_day' ? 0 : 1}
              onSelect={idx =>
                setSchedule(p => ({
                  ...p,
                  durationType: idx === 0 ? 'entire_day' : 'specific_hours',
                }))
              }
            />
          </View>
          {schedule.durationType === 'specific_hours' && (
            <View style={styles.subSection}>
              <TimeRangeSlider
                startTime={schedule.from}
                endTime={schedule.to}
                onStartTimeChange={v => setSchedule(p => ({ ...p, from: v }))}
                onEndTimeChange={v => setSchedule(p => ({ ...p, to: v }))}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Typography variant="body" color="inverse" style={styles.label}>
              Criteria
            </Typography>
            <SegmentedControl
              options={['Distance', 'Time']}
              selectedIndex={criteria.type === 'distance' ? 0 : 1}
              onSelect={idx =>
                setCriteria(p => ({
                  ...p,
                  type: idx === 0 ? 'distance' : 'time',
                }))
              }
            />
          </View>

          <View style={[styles.row, styles.subSection]}>
            <View style={styles.valueGroup}>
              <Text style={styles.bigValue}>
                {criteria.type === 'distance'
                  ? currentValue.toFixed(1)
                  : currentValue}
              </Text>
              <Text style={styles.unitLabel}>{config.label.toUpperCase()}</Text>
            </View>

            {criteria.type === 'distance' && (
              <SegmentedControl
                size="sm"
                options={['mi', 'km']}
                selectedIndex={criteria.unit === 'mi' ? 0 : 1}
                onSelect={handleUnitChange}
              />
            )}
          </View>

          <View>
            <Slider
              min={config.min}
              max={config.max}
              value={currentValue}
              step={config.step}
              showValue={false}
              style={styles.slider}
              onValueChange={v =>
                setCriteria(p => ({
                  ...p,
                  value: { ...p.value, [criteria.type]: v },
                }))
              }
            />
            <View style={styles.row}>
              <Typography mode="dark" variant="body">
                {config.min} {config.label}
              </Typography>
              <Typography mode="dark" variant="body">
                {config.max} {config.label}
              </Typography>
            </View>
          </View>
        </View>

        <AppBlockList
          apps={blockedApps}
          onEdit={() => setShowBlocklist(true)}
        />
      </View>

      <View style={styles.footer}>
        <Button size="lg" onPress={handleSavePlan}>
          {plan ? 'Save Changes' : 'Continue'}
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  subSection: {
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    letterSpacing: 1,
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  bigValue: {
    fontSize: 48,
    fontWeight: '500',
    color: colors.neutral.white,
  },
  unitLabel: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.neutral.white,
  },
  slider: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  footer: {
    paddingTop: spacing.md,
  },
});
