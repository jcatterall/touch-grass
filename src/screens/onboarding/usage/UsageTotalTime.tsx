import { StyleSheet, Text, View } from 'react-native';
import { Typography } from '../../../components';
import { borderRadius, colors, spacing } from '../../../theme';

interface UsageTotalTimeProps {
  totalHours: number;
}

export const UsageTotalTime = ({ totalHours }: UsageTotalTimeProps) => {
  return (
    <View style={styles.container}>
      <Typography mode="dark" variant="subtitle">
        Screen time avg.
      </Typography>
      <View style={styles.rightContent}>
        <Text style={styles.countText}>{totalHours}h</Text>
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
    color: colors.primary.blue,
  },
});
