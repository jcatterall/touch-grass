import { View, Text, StyleSheet } from 'react-native';
import { UsageApps } from '../../../components/usage/UsageApps';
import { UsageChart } from '../../../components/usage/UsageChart';
import { UsagePickups } from '../../../components/usage/UsagePickups';
import { spacing, typography } from '../../../theme';
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
      <Text style={typography.styles.light.subheading}>
        Your current screen time
      </Text>
      <Text style={typography.styles.light.largeTitle}>
        {average.hours}h {average.minutes}m
      </Text>
      <Text style={typography.styles.light.body}>Last week avg.</Text>
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
