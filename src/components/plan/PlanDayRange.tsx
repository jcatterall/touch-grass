import { StyleSheet, View } from 'react-native';
import { SegmentedControl } from '../SegmentedControl';
import { TimeRangeSlider } from '../TimeRangeSlider';
import { Typography } from '../Typography';
import { spacing } from '../../theme';
import { DurationType } from '../../types';

export interface DayRangeState {
  durationType: DurationType;
  from: string;
  to: string;
}

export interface PlanDayRangeProps {
  range: DayRangeState;
  onRangeChange: (range: DayRangeState) => void;
}

export const PlanDayRange = ({ range, onRangeChange }: PlanDayRangeProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Typography variant="body" style={styles.label}>
          Range
        </Typography>
        <SegmentedControl
          options={['Entire Day', 'Specific Hours']}
          selectedIndex={range.durationType === 'entire_day' ? 0 : 1}
          onSelect={idx =>
            onRangeChange({
              ...range,
              durationType: idx === 0 ? 'entire_day' : 'specific_hours',
            })
          }
        />
      </View>
      {range.durationType === 'specific_hours' && (
        <TimeRangeSlider
          startTime={range.from}
          endTime={range.to}
          onStartTimeChange={v => onRangeChange({ ...range, from: v })}
          onEndTimeChange={v => onRangeChange({ ...range, to: v })}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    letterSpacing: 1,
  },
});
