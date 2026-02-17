import { useEffect, useMemo } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TreePine } from 'lucide-react-native';
import { Typography } from '../../components';
import { ProgressRing } from '../../components/ProgressRing';
import { useTracking, AggregatedGoals } from '../../hooks/useTracking';
import { TrackingProgress } from '../../native/Tracking';
import { colors, spacing } from '../../theme';

const MESSAGES = [
  'Time to touch some grass!',
  'Nature is calling you!',
  'Fresh air awaits!',
  'Step outside and breathe!',
  'Your apps will wait for you!',
  'Go explore the world!',
  'The outdoors miss you!',
];

function getOverallFraction(
  goals: AggregatedGoals,
  progress: TrackingProgress,
): number {
  const fractions: number[] = [];
  if (goals.hasDistanceGoal) {
    fractions.push(
      Math.min(progress.distanceMeters / goals.totalDistanceMeters, 1),
    );
  }
  if (goals.hasTimeGoal) {
    fractions.push(
      Math.min(progress.elapsedSeconds / goals.totalTimeSeconds, 1),
    );
  }
  if (fractions.length === 0) return 0;
  return fractions.reduce((a, b) => a + b, 0) / fractions.length;
}

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)}m`
    : `${(meters / 1000).toFixed(1)}km`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return sec > 0 && seconds < 3600 ? `${min}m ${sec}s` : `${min}min`;
}

interface BlockingScreenProps {
  blockedPackage: string;
}

export const BlockingScreen = ({ blockedPackage }: BlockingScreenProps) => {
  const insets = useSafeAreaInsets();
  const { progress, goals, allGoalsReached } = useTracking();
  const fraction = getOverallFraction(goals, progress);

  const message = useMemo(
    () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
    [],
  );

  // Block the Android back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const remainingDistance = goals.hasDistanceGoal
    ? Math.max(goals.totalDistanceMeters - progress.distanceMeters, 0)
    : 0;
  const remainingTime = goals.hasTimeGoal
    ? Math.max(goals.totalTimeSeconds - progress.elapsedSeconds, 0)
    : 0;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.iconContainer}>
        <TreePine size={48} color={colors.meadowGreen} />
      </View>

      <Typography variant="heading" style={styles.title}>
        {allGoalsReached ? 'Goal Reached!' : 'App Blocked'}
      </Typography>

      <Typography variant="body" style={styles.message}>
        {allGoalsReached ? 'Congratulations! You made it!' : message}
      </Typography>

      <ProgressRing progress={fraction} size={160} strokeWidth={12} />

      <View style={styles.statsCard}>
        {goals.hasDistanceGoal && (
          <View style={styles.statRow}>
            <Typography variant="body" style={styles.statLabel}>
              Distance
            </Typography>
            <Typography variant="subtitle" style={styles.statValue}>
              {formatDistance(progress.distanceMeters)} /{' '}
              {formatDistance(goals.totalDistanceMeters)}
            </Typography>
          </View>
        )}
        {goals.hasTimeGoal && (
          <View style={styles.statRow}>
            <Typography variant="body" style={styles.statLabel}>
              Time
            </Typography>
            <Typography variant="subtitle" style={styles.statValue}>
              {formatTime(progress.elapsedSeconds)} /{' '}
              {formatTime(goals.totalTimeSeconds)}
            </Typography>
          </View>
        )}
        {!allGoalsReached && (remainingDistance > 0 || remainingTime > 0) && (
          <>
            <View style={styles.divider} />
            <Typography variant="body" style={styles.remaining}>
              {goals.hasDistanceGoal && `${formatDistance(remainingDistance)} `}
              {goals.hasDistanceGoal && goals.hasTimeGoal && '& '}
              {goals.hasTimeGoal && `${formatTime(remainingTime)} `}
              remaining
            </Typography>
          </>
        )}
      </View>

      {!allGoalsReached && (
        <Typography variant="caption" style={styles.hint}>
          Complete your goals to unlock this app
        </Typography>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.white,
    textAlign: 'center',
  },
  message: {
    color: colors.backgroundTertiary,
    textAlign: 'center',
  },
  statsCard: {
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: colors.backgroundTertiary,
  },
  statValue: {
    color: colors.white,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: spacing.xs,
  },
  remaining: {
    color: colors.terracotta,
    textAlign: 'center',
  },
  hint: {
    color: colors.backgroundTertiary,
    textAlign: 'center',
  },
});
