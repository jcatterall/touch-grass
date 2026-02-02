import { View, Text, StyleSheet } from 'react-native';
import { type DailyUsage } from '../../native/UsageStats';
import { colors, spacing, typography } from '../../theme';
import { calculateAverage, formatTime } from './Usage.utils';

export const UsageChart = ({ data }: { data: DailyUsage[] }) => {
  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No usage data available</Text>
      </View>
    );
  }

  const maxMinutes = Math.max(...data.map(d => d.totalMinutes));
  const chartHeight = 150;
  const average = calculateAverage(data);
  const avgMinutes = average.hours * 60 + average.minutes;
  const avgLinePosition =
    maxMinutes > 0 ? chartHeight - (avgMinutes / maxMinutes) * chartHeight : 0;

  return (
    <View style={styles.container}>
      {maxMinutes > 0 && (
        <View style={[styles.avgLine, { top: avgLinePosition }]} />
      )}

      <View style={styles.barsContainer}>
        {data.map((day, index) => {
          const barHeight =
            maxMinutes > 0 ? (day.totalMinutes / maxMinutes) * chartHeight : 0;
          const isToday = index === data.length - 1;
          const isTodayStyle = {
            height: Math.max(barHeight, 4),
            backgroundColor: isToday
              ? colors.primary.blue
              : 'rgba(48, 149, 255, 0.7)',
          };
          return (
            <View key={`${day.day}-${index}`} style={styles.barWrapper}>
              <View style={styles.barArea}>
                <View style={[styles.bar, isTodayStyle]} />
              </View>
              <Text style={typography.styles.light.caption}>{day.day}</Text>
              <Text style={typography.styles.light.small}>
                {formatTime(day.hours, day.minutes)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 220,
    position: 'relative',
  },
  emptyContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.styles.dark.body,
    color: colors.dark.textSecondary,
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
    paddingHorizontal: spacing.xs,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barArea: {
    height: 180,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    width: 28,
    borderRadius: 6,
    minHeight: 4,
  },
});
