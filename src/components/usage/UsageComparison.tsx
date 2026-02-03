import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const UsageComparison = ({
  label,
  value,
  maxValue,
  suffix,
  isReduced,
}: {
  label: string;
  value: number;
  maxValue: number;
  suffix: string;
  isReduced?: boolean;
}) => {
  const barWidth =
    (value / maxValue) * (SCREEN_WIDTH - spacing.screenPadding * 2 - 100);

  return (
    <View style={styles.barContainer}>
      <View style={styles.barWrapper}>
        <View
          style={[
            styles.bar,
            { width: Math.max(barWidth, 60) },
            isReduced ? styles.barReduced : styles.barNormal,
          ]}
        >
          <Text style={styles.barValue}>{suffix}</Text>
        </View>
        <Text style={styles.barLabel}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.cardBackground,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bar: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
  },
  barNormal: {
    backgroundColor: '#FF6B6B',
  },
  barReduced: {
    backgroundColor: '#3478F6',
  },
  barValue: {
    color: colors.dark.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  barLabel: {
    color: colors.dark.textSecondary,
    fontSize: 14,
    marginLeft: spacing.sm,
    flex: 1,
    textAlign: 'right',
    paddingRight: spacing.md,
  },
});
