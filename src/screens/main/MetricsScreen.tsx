import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, SegmentedControl, Typography } from '../../components';
import { MainScreen } from '../../components/layout/MainScreen';
import { colors, spacing } from '../../theme';
import {
  MetricsPeriod,
  NativeMetricsSeries,
  NativeMetricsSummary,
  Tracking,
} from '../../tracking/Tracking';
import UsageStats from '../../native/UsageStats';

interface MetricsScreenProps {
  onClose: () => void;
}

const PERIODS: MetricsPeriod[] = ['day', 'week', 'month'];

const PERIOD_LABELS = ['Day', 'Week', 'Month'];

function formatDistance(distanceMeters: number): string {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(distanceMeters)} m`;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const MetricsScreen = ({ onClose }: MetricsScreenProps) => {
  const [periodIndex, setPeriodIndex] = useState(0);
  const [summary, setSummary] = useState<NativeMetricsSummary | null>(null);
  const [series, setSeries] = useState<NativeMetricsSeries | null>(null);
  const [allTimeDistance, setAllTimeDistance] = useState(0);
  const [allTimeElapsed, setAllTimeElapsed] = useState(0);
  const [allTimeStreak, setAllTimeStreak] = useState(0);
  const [allTimeLongestStreak, setAllTimeLongestStreak] = useState(0);
  const [allTimeBlockedAttempts, setAllTimeBlockedAttempts] = useState(0);
  const [allTimeNotificationsBlocked, setAllTimeNotificationsBlocked] =
    useState(0);
  const [hasUsagePermission, setHasUsagePermission] = useState(false);
  const [topApps, setTopApps] = useState<string[]>([]);

  const period = PERIODS[periodIndex] ?? 'day';

  const refreshAllTime = useCallback(async () => {
    const allTime = await Tracking.getMetricsSummary('alltime');
    setAllTimeDistance(allTime.distanceMeters);
    setAllTimeElapsed(allTime.elapsedSeconds);
    setAllTimeStreak(allTime.currentGoalStreakDays);
    setAllTimeLongestStreak(allTime.longestGoalStreakDays);
    setAllTimeBlockedAttempts(allTime.blockedAttempts ?? 0);
    setAllTimeNotificationsBlocked(allTime.notificationsBlocked ?? 0);
  }, []);

  const refreshPeriod = useCallback(async () => {
    const [nextSummary, nextSeries] = await Promise.all([
      Tracking.getMetricsSummary(period),
      Tracking.getMetricsSeries(period),
    ]);
    setSummary(nextSummary);
    setSeries(nextSeries);
  }, [period]);

  const refreshUsage = useCallback(async () => {
    const granted = await UsageStats.hasPermission();
    setHasUsagePermission(granted);
    if (!granted) {
      setTopApps([]);
      return;
    }
    const apps = await UsageStats.getAppUsage();
    setTopApps(apps.slice(0, 3).map(a => `${a.name} (${a.time})`));
  }, []);

  useEffect(() => {
    refreshAllTime().catch(() => {});
    refreshUsage().catch(() => {});
  }, [refreshAllTime, refreshUsage]);

  useEffect(() => {
    refreshPeriod().catch(() => {});
  }, [refreshPeriod]);

  useEffect(() => {
    const sub = Tracking.onTrackingStopped(() => {
      refreshPeriod().catch(() => {});
      refreshAllTime().catch(() => {});
    });
    return () => sub?.remove();
  }, [refreshAllTime, refreshPeriod]);

  const avgDistance = useMemo(() => {
    if (!series || series.points.length === 0) return 0;
    const total = series.points.reduce((acc, p) => acc + p.distanceMeters, 0);
    return total / series.points.length;
  }, [series]);

  return (
    <MainScreen label="Metrics" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.content}>
        <SegmentedControl
          options={PERIOD_LABELS}
          selectedIndex={periodIndex}
          onSelect={setPeriodIndex}
        />

        <Card style={styles.card} hideChevron>
          <Typography color="accent" variant="subtitle">
            Activity ({PERIOD_LABELS[periodIndex]})
          </Typography>
          <View style={styles.row}>
            <Typography>Distance</Typography>
            <Typography>
              {formatDistance(summary?.distanceMeters ?? 0)}
            </Typography>
          </View>
          <View style={styles.row}>
            <Typography>Time elapsed</Typography>
            <Typography>
              {formatElapsed(summary?.elapsedSeconds ?? 0)}
            </Typography>
          </View>
          <View style={styles.row}>
            <Typography>Goals reached days</Typography>
            <Typography>
              {Math.round(summary?.goalsReachedDays ?? 0)}
            </Typography>
          </View>
        </Card>

        <Card style={styles.card} hideChevron>
          <Typography color="accent" variant="subtitle">
            Blocking ({PERIOD_LABELS[periodIndex]})
          </Typography>
          <View style={styles.row}>
            <Typography>Blocked attempts</Typography>
            <Typography>{Math.round(summary?.blockedAttempts ?? 0)}</Typography>
          </View>
          <View style={styles.row}>
            <Typography>Notifications blocked</Typography>
            <Typography>
              {Math.round(summary?.notificationsBlocked ?? 0)}
            </Typography>
          </View>
        </Card>

        <Card style={styles.card} hideChevron>
          <Typography color="accent" variant="subtitle">
            Streaks
          </Typography>
          <View style={styles.row}>
            <Typography>Current streak</Typography>
            <Typography>
              {Math.round(summary?.currentGoalStreakDays ?? 0)} days
            </Typography>
          </View>
          <View style={styles.row}>
            <Typography>Longest streak</Typography>
            <Typography>
              {Math.round(summary?.longestGoalStreakDays ?? 0)} days
            </Typography>
          </View>
        </Card>

        <Card style={styles.card} hideChevron>
          <Typography color="accent" variant="subtitle">
            All Time
          </Typography>
          <View style={styles.row}>
            <Typography>Distance</Typography>
            <Typography>{formatDistance(allTimeDistance)}</Typography>
          </View>
          <View style={styles.row}>
            <Typography>Elapsed</Typography>
            <Typography>{formatElapsed(allTimeElapsed)}</Typography>
          </View>
          <View style={styles.row}>
            <Typography>Current / longest streak</Typography>
            <Typography>
              {allTimeStreak} / {allTimeLongestStreak}
            </Typography>
          </View>
          <View style={styles.row}>
            <Typography>Blocked attempts</Typography>
            <Typography>{allTimeBlockedAttempts}</Typography>
          </View>
          <View style={styles.row}>
            <Typography>Notifications blocked</Typography>
            <Typography>{allTimeNotificationsBlocked}</Typography>
          </View>
        </Card>

        <Card style={styles.card} hideChevron>
          <Typography color="accent" variant="subtitle">
            Period Insight
          </Typography>
          <Typography>
            Avg daily distance: {formatDistance(avgDistance)}
          </Typography>
          <Typography>Days in period: {series?.points.length ?? 0}</Typography>
        </Card>

        <Card style={styles.card} hideChevron>
          <Typography color="accent" variant="subtitle">
            Usage
          </Typography>
          {!hasUsagePermission ? (
            <Typography color="disabled">
              Usage permission required to view app usage charts and top apps.
            </Typography>
          ) : (
            <View style={styles.usageList}>
              {topApps.length === 0 ? (
                <Typography>No app usage data available yet.</Typography>
              ) : (
                topApps.map(app => <Typography key={app}>{app}</Typography>)
              )}
            </View>
          )}
        </Card>
      </ScrollView>
    </MainScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  usageList: {
    gap: spacing.xxxs,
  },
});
