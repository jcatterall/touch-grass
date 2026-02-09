import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import {
  Button,
  DayChip,
  SegmentedControl,
  Typography,
} from '../../components';
import { TimeRangeSlider } from '../../components/TimeRangeSlider';
import { AppBlockList } from '../../components/AppBlockList';
import { Slider } from '../../components/Slider';
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

export interface PlanProps {
  onComplete: (plan: BlockingPlan) => void;
  onBack?: () => void;
}

const DISTANCE_CONFIG = {
  km: { min: 1, max: 15, step: 0.5, label: 'km' },
  mi: { min: 0.5, max: 10, step: 0.5, label: 'mi' },
} as const;

const CRITERIA_CONFIG = {
  distance: DISTANCE_CONFIG.km,
  time: { min: 5, max: 120, step: 5, label: 'min' },
} as const;

export const Plan = ({ onComplete }: PlanProps) => {
  const [selectedDays, setSelectedDays] = useState<DayKey[]>([
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
  ]);
  const [durationType, setDurationType] =
    useState<DurationType>('specific_hours');
  const [fromTime, setFromTime] = useState('09:00 AM');
  const [toTime, setToTime] = useState('05:00 PM');
  const [criteriaType, setCriteriaType] = useState<CriteriaType>('distance');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [criteriaValue, setCriteriaValue] = useState({
    distance: 5.0,
    time: 30,
  });
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blockedApps, setBlockedApps] = useState<AppItem[]>([]);

  const toggleDay = (day: DayKey) => {
    triggerHaptic('selection');
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  };

  const handleSaveRule = () => {
    triggerHaptic('impactMedium');
    const plan: BlockingPlan = {
      days: selectedDays,
      duration:
        durationType === 'entire_day'
          ? { type: 'entire_day' }
          : { type: 'specific_hours', from: fromTime, to: toTime },
      criteria:
        criteriaType === 'distance'
          ? {
              type: 'distance',
              value: criteriaValue.distance,
              unit: distanceUnit,
            }
          : { type: 'time', value: criteriaValue.time },
      blockedApps: blockedApps.map(app => ({
        id: app.id,
        name: app.name,
        icon: app.icon,
      })),
    };
    onComplete(plan);
  };

  const config =
    criteriaType === 'distance'
      ? DISTANCE_CONFIG[distanceUnit]
      : CRITERIA_CONFIG.time;
  const currentValue = criteriaValue[criteriaType];

  const handleBlocklistSave = (selectedApps: AppItem[]) => {
    setBlockedApps(selectedApps);
    setShowBlocklist(false);
  };

  if (showBlocklist) {
    return (
      <BlocklistScreen
        selectedApps={blockedApps}
        onSave={handleBlocklistSave}
        onClose={() => setShowBlocklist(false)}
      />
    );
  }

  return (
    <OnboardingContainer>
      <View style={styles.container}>
        <Typography mode="dark" variant="title">
          Your plan
        </Typography>
        <View style={{ ...styles.frequencySection, ...styles.section }}>
          <Typography
            variant="body"
            color="inverse"
            style={styles.sectionLabel}
          >
            Repeat
          </Typography>
          <View style={styles.daysContainer}>
            {DAYS.map(day => (
              <DayChip
                key={day.key}
                label={day.label}
                isSelected={selectedDays.includes(day.key)}
                onPress={() => toggleDay(day.key)}
                mode="dark"
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Typography
              variant="body"
              color="inverse"
              style={styles.sectionLabel}
            >
              Range
            </Typography>
            <SegmentedControl
              options={['Entire Day', 'Specific Hours']}
              selectedIndex={durationType === 'entire_day' ? 0 : 1}
              onSelect={index =>
                setDurationType(index === 0 ? 'entire_day' : 'specific_hours')
              }
            />
          </View>
          {durationType === 'specific_hours' && (
            <View style={styles.timeSection}>
              <TimeRangeSlider
                startTime={fromTime}
                endTime={toTime}
                onStartTimeChange={setFromTime}
                onEndTimeChange={setToTime}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Typography
              variant="body"
              color="inverse"
              style={styles.sectionLabel}
            >
              Criteria
            </Typography>
            <SegmentedControl
              options={['Distance', 'Time']}
              selectedIndex={criteriaType === 'distance' ? 0 : 1}
              onSelect={index =>
                setCriteriaType(index === 0 ? 'distance' : 'time')
              }
            />
          </View>

          <View style={{ ...styles.criteriaValueRow, ...styles.section }}>
            <View style={styles.criteriaValueGroup}>
              <Text style={styles.criteriaValue}>
                {criteriaType === 'distance'
                  ? currentValue.toFixed(1)
                  : currentValue}
              </Text>
              <Text style={styles.criteriaUnit}>
                {config.label.toUpperCase()}
              </Text>
            </View>
            {criteriaType === 'distance' && (
              <View>
                <SegmentedControl
                  size="sm"
                  options={['mi', 'km']}
                  selectedIndex={distanceUnit === 'mi' ? 0 : 1}
                  onSelect={index => {
                    const newUnit = index === 0 ? 'mi' : 'km';
                    if (newUnit !== distanceUnit) {
                      const convertedValue =
                        distanceUnit === 'km'
                          ? criteriaValue.distance * KM_TO_MI
                          : criteriaValue.distance * MI_TO_KM;
                      const clampedValue = Math.min(
                        Math.max(convertedValue, DISTANCE_CONFIG[newUnit].min),
                        DISTANCE_CONFIG[newUnit].max,
                      );
                      setCriteriaValue(prev => ({
                        ...prev,
                        distance: Math.round(clampedValue * 2) / 2,
                      }));
                      setDistanceUnit(newUnit);
                    }
                  }}
                />
              </View>
            )}
          </View>

          <View style={{ ...styles.sliderSection, ...styles.section }}>
            <Slider
              min={config.min}
              max={config.max}
              value={currentValue}
              step={config.step}
              onValueChange={v =>
                setCriteriaValue(prev => ({ ...prev, [criteriaType]: v }))
              }
              showValue={false}
              style={styles.sliderStyle}
            />
            <View style={styles.sliderLabels}>
              <Typography mode="dark" variant="body" color="secondary">
                {config.min} {config.label}
              </Typography>
              <Typography mode="dark" variant="body" color="secondary">
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
        <Button size="lg" onPress={handleSaveRule}>
          Continue
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxxl,
  },
  section: {},
  sectionLabel: {
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  frequencySection: {
    gap: spacing.sm,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeSection: {
    marginTop: spacing.xs,
  },
  criteriaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  criteriaValueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  criteriaValue: {
    fontSize: 48,
    fontWeight: '500',
    color: colors.neutral.white,
  },
  criteriaUnit: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.neutral.white,
  },
  sliderSection: {
    marginTop: spacing.xs,
  },
  sliderStyle: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  footer: {
    paddingTop: spacing.md,
  },
});
