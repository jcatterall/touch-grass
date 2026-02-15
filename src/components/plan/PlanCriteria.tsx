import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../Card';
import { Typography } from '../Typography';
import { SegmentedControl } from '../SegmentedControl';
import Slider from '../Slider';
import { spacing, colors } from '../../theme';
import { triggerHaptic } from '../../utils/haptics';
import { CriteriaType, DistanceUnit, KM_TO_MI, MI_TO_KM } from '../../types';

const DISTANCE_CONFIG = {
  km: { min: 1, max: 15, step: 0.5, label: 'km' },
  mi: { min: 0.5, max: 10, step: 0.5, label: 'mi' },
} as const;

const TIME_CONFIG = { min: 5, max: 120, step: 5, label: 'min' } as const;

const CRITERIA_OPTIONS: { type: CriteriaType; label: string }[] = [
  { type: 'distance', label: 'Block by distance' },
  { type: 'time', label: 'Block by time' },
  { type: 'permanent', label: 'Block permanently' },
];

export interface CriteriaState {
  type: CriteriaType | null;
  unit: DistanceUnit;
  value: { distance: number; time: number };
}

export interface PlanCriteriaProps {
  criteria: CriteriaState;
  onCriteriaChange: (criteria: CriteriaState) => void;
}

export const PlanCriteria = ({
  criteria,
  onCriteriaChange,
}: PlanCriteriaProps) => {
  const handleSelect = (type: CriteriaType) => {
    triggerHaptic('selection');
    onCriteriaChange({ ...criteria, type });
  };

  const handleClear = () => {
    triggerHaptic('selection');
    onCriteriaChange({ ...criteria, type: null });
  };

  const handleUnitChange = (index: number) => {
    const newUnit: DistanceUnit = index === 0 ? 'mi' : 'km';
    if (newUnit === criteria.unit) return;

    const isKm = criteria.unit === 'km';
    const converted = isKm
      ? criteria.value.distance * KM_TO_MI
      : criteria.value.distance * MI_TO_KM;

    const limits = DISTANCE_CONFIG[newUnit];
    const clamped = Math.min(Math.max(converted, limits.min), limits.max);

    onCriteriaChange({
      ...criteria,
      unit: newUnit,
      value: { ...criteria.value, distance: Math.round(clamped * 2) / 2 },
    });
  };

  const selectedOption = CRITERIA_OPTIONS.find(o => o.type === criteria.type);
  const isDistanceOrTime =
    criteria.type === 'distance' || criteria.type === 'time';

  const config =
    criteria.type === 'distance' ? DISTANCE_CONFIG[criteria.unit] : TIME_CONFIG;

  const currentValue =
    criteria.type === 'distance'
      ? criteria.value.distance
      : criteria.value.time;

  return (
    <View style={styles.container}>
      <Typography variant="body" style={styles.label}>
        Criteria
      </Typography>

      {criteria.type === null ? (
        <View style={styles.options}>
          {CRITERIA_OPTIONS.map(option => (
            <Card
              key={option.type}
              variant="secondary"
              onPress={() => handleSelect(option.type)}
            >
              <Typography variant="body">{option.label}</Typography>
            </Card>
          ))}
        </View>
      ) : (
        <View style={styles.options}>
          <Card variant="primary" onClose={handleClear}>
            <Typography variant="body">{selectedOption?.label}</Typography>
          </Card>

          {isDistanceOrTime && (
            <View style={styles.config}>
              <View style={styles.row}>
                <View style={styles.valueGroup}>
                  <Text style={styles.bigValue}>
                    {criteria.type === 'distance'
                      ? currentValue.toFixed(1)
                      : currentValue}
                  </Text>
                  <Text style={styles.unitLabel}>
                    {config.label.toUpperCase()}
                  </Text>
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
                    onCriteriaChange({
                      ...criteria,
                      value: {
                        ...criteria.value,
                        [criteria.type as 'distance' | 'time']: v,
                      },
                    })
                  }
                />
                <View style={styles.row}>
                  <Typography variant="body">
                    {config.min} {config.label}
                  </Typography>
                  <Typography variant="body">
                    {config.max} {config.label}
                  </Typography>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    letterSpacing: 1,
  },
  options: {
    gap: spacing.xs,
  },
  config: {
    gap: spacing.xxs,
    paddingTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  bigValue: {
    fontSize: 48,
    fontWeight: '500',
    color: colors.white,
  },
  unitLabel: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.white,
  },
  slider: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
