import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { spacing, typography } from '../../theme';
import { Button } from '../../components';
import UsageStats, {
  type DailyUsage,
  type AppUsage,
} from '../../native/UsageStats';
import { calculateAverage } from '../../components/usage/Usage.utils';
import { UsageChart } from '../../components/usage/UsageChart';
import { UsagePickups } from '../../components/usage/UsagePickups';
import { UsageApps } from '../../components/usage/UsageApps';

export interface UsageReportProps {
  onComplete: () => void;
  usage?: number;
}

export const UsageReport = ({ onComplete }: UsageReportProps) => {
  const [weeklyData, setWeeklyData] = useState<DailyUsage[]>([]);
  const [appData, setAppData] = useState<AppUsage[]>([]);
  const [pickupCount, setPickupCount] = useState(0);

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        const hasPermission = await UsageStats.hasPermission();
        if (!hasPermission) {
          return;
        }

        const [weekly, apps, pickups] = await Promise.all([
          UsageStats.getWeeklyUsage(),
          UsageStats.getAppUsage(),
          UsageStats.getDailyPickups(),
        ]);

        setWeeklyData(weekly);
        setAppData(apps);
        setPickupCount(pickups);
      } catch (error) {
        console.error('Error fetching usage data:', error);
      }
    };

    fetchUsageData();
  }, []);

  const handleContinue = () => {
    onComplete();
  };

  const average = calculateAverage(weeklyData);

  return (
    <OnboardingContainer>
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
        <UsagePickups count={pickupCount} />
      </View>

      <Button size="lg" onPress={handleContinue}>
        Continue
      </Button>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
