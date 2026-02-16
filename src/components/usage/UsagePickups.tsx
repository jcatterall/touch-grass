import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing } from '../../theme';
import Chip, { type ChipColor } from '../Chip';
import { Typography } from '../Typography';

const getPickupStatus = (count: number): { label: string; color: ChipColor } => {
  if (count < 30) return { label: 'Low', color: 'green' };
  if (count < 60) return { label: 'Normal', color: 'blue' };
  if (count < 100) return { label: 'High', color: 'red' };
  return { label: 'Very High', color: 'red' };
};

export const UsagePickups = ({ count }: { count: number }) => {
  const status = getPickupStatus(count);

  return (
    <View style={styles.container}>
      <Typography variant="subtitle">Daily pickups</Typography>
      <View style={styles.rightContent}>
        <Text style={styles.countText}>{count}x</Text>
        <Chip label={status.label} color={status.color} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  rightContent: {
    gap: spacing.sm,
    alignContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  countText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.meadowGreen,
  },
});
