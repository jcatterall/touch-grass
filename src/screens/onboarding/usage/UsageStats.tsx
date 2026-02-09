import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
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
    <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
      <Typography mode="dark" variant="subtitle" color="primary">
        Your current screen time
      </Typography>
      <Typography mode="dark" variant="heading">
        {average.hours}h {average.minutes}m
      </Typography>
      <Typography mode="dark" variant="body" color="secondary">
        Last week avg.
      </Typography>
    </Animated.View>
    <Animated.View entering={FadeInUp.delay(0).duration(400)}>
      <UsageChart data={weeklyData} />
    </Animated.View>
    <Animated.View entering={FadeInUp.delay(200).duration(400)}>
      <UsageApps apps={appData} />
    </Animated.View>
    <Animated.View entering={FadeInUp.delay(400).duration(400)}>
      <UsagePickups count={average.pickups} />
    </Animated.View>
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
