import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing } from '../../theme';
import Chip from '../Chip';
import { Typography } from '../Typography';

const getPickupStatus = (count: number): string => {
  if (count < 30) return 'Low';
  if (count < 60) return 'Normal';
  if (count < 100) return 'High';
  return 'Very High';
};

export const UsagePickups = ({ count }: { count: number }) => {
  const status = getPickupStatus(count);

  return (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        <Typography mode="dark" variant="subtitle">
          Daily pickups
        </Typography>
        <Chip label={status} variant="blue" size="sm" mode="dark" isSelected />
      </View>
      <Text style={styles.countText}>{count}x</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftContent: {
    gap: spacing.xs,
  },
  countText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary.blue,
  },
});
