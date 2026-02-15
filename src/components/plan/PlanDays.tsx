import { StyleSheet, View } from 'react-native';
import { DayChip } from '../DayChip';
import { Typography } from '../Typography';
import { spacing } from '../../theme';
import { triggerHaptic } from '../../utils/haptics';
import { DayKey, DAYS } from '../../types';

export interface AppBlockDaysProps {
  days: DayKey[];
  onDaysChange: (days: DayKey[]) => void;
}

export const PlanDays = ({ days, onDaysChange }: AppBlockDaysProps) => {
  const toggleDay = (day: DayKey) => {
    triggerHaptic('selection');
    const next = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day];
    onDaysChange(next);
  };

  return (
    <View style={styles.container}>
      <Typography variant="body" style={styles.label}>
        Days
      </Typography>
      <View style={styles.row}>
        {DAYS.map(day => (
          <DayChip
            key={day.key}
            label={day.label}
            isSelected={days.includes(day.key)}
            onPress={() => toggleDay(day.key)}
          />
        ))}
      </View>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
