import { View, StyleSheet } from 'react-native';
import { UsageApps } from '../../../components/usage/UsageApps';
import { UsageChart } from '../../../components/usage/UsageChart';
import { UsagePickups } from '../../../components/usage/UsagePickups';
import { spacing } from '../../../theme';
import { Typography } from '../../../components';
import { AppUsage, DailyUsage } from '../../../native/UsageStats';

interface UsageStatsProps {
  weeklyData: DailyUsage[];
  appData: AppUsage[];
  average: {
    hours: number;
    minutes: number;
    pickups: number;
  };
}

export const UsageStatsPage = ({
  average,
  appData,
  weeklyData,
}: UsageStatsProps) => (
  <View style={styles.content}>
    <View style={styles.header}>
      <Typography variant="subtitle" color="primary">
        Your current screen time
      </Typography>
      <Typography variant="heading">
        {average.hours}h {average.minutes}m
      </Typography>
      <Typography variant="body" color="secondary">
        Last week avg.
      </Typography>
    </View>
    <UsageChart data={weeklyData} />
    <UsageApps apps={appData} />
    <UsagePickups count={average.pickups} />
  </View>
);

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  content: {
    flex: 1,
    gap: spacing.xl,
  },
});
