import { useEffect, useMemo, useState, useCallback } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TreePine, X } from 'lucide-react-native';
import { AppBlocker } from '../../native/AppBlocker';
import { Typography } from '../../components';
import { ProgressRing } from '../../components/ProgressRing';
import {
  findBlockingPlansForToday,
  AggregatedGoals,
} from '../../hooks/useTracking';
import { Tracking, TrackingProgress } from '../../native/Tracking';
import { storage } from '../../storage';
import { BlockingPlan } from '../../types';
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

function aggregateUnmetGoals(
  plans: BlockingPlan[],
  progress: TrackingProgress,
): AggregatedGoals {
  let totalDistanceMeters = 0;
  let totalTimeSeconds = 0;

  for (const plan of plans) {
    if (plan.criteria.type === 'distance') {
      const meters =
        plan.criteria.unit === 'mi'
          ? plan.criteria.value * 1609.34
          : plan.criteria.value * 1000;
      if (progress.distanceMeters < meters) {
        totalDistanceMeters += meters;
      }
    } else if (plan.criteria.type === 'time') {
      const seconds = plan.criteria.value * 60;
      if (progress.elapsedSeconds < seconds) {
        totalTimeSeconds += seconds;
      }
    }
  }

  return {
    totalDistanceMeters,
    totalTimeSeconds,
    hasDistanceGoal: totalDistanceMeters > 0,
    hasTimeGoal: totalTimeSeconds > 0,
  };
}

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
  const [progress, setProgress] = useState<TrackingProgress>({
    distanceMeters: 0,
    elapsedSeconds: 0,
    goalReached: false,
  });
  const [goals, setGoals] = useState<AggregatedGoals>({
    totalDistanceMeters: 0,
    totalTimeSeconds: 0,
    hasDistanceGoal: false,
    hasTimeGoal: false,
  });

  const message = useMemo(
    () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
    [],
  );

  const dismiss = useCallback(() => {
    AppBlocker.setImmersiveMode(false);
    AppBlocker.dismissBlockingScreen();
  }, []);

  // Hide navigation bar to prevent swipe-up gesture to Recents
  useEffect(() => {
    AppBlocker.setImmersiveMode(true);
    return () => { AppBlocker.setImmersiveMode(false); };
  }, []);

  // Block the Android back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Read-only: load progress and goals from storage + native service
  const loadState = useCallback(async () => {
    const [todayActivity, sessionProgress, plans] = await Promise.all([
      storage.getTodayActivity(),
      Tracking.getProgress(),
      storage.getPlans(),
    ]);

    const combined: TrackingProgress = {
      distanceMeters:
        todayActivity.distanceMeters + sessionProgress.distanceMeters,
      elapsedSeconds:
        todayActivity.elapsedSeconds + sessionProgress.elapsedSeconds,
      goalReached: sessionProgress.goalReached,
    };

    setProgress(combined);

    const blockingPlans = findBlockingPlansForToday(plans);
    setGoals(aggregateUnmetGoals(blockingPlans, combined));
  }, []);

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 2000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') loadState();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [loadState]);

  const fraction = getOverallFraction(goals, progress);

  const remainingDistance = goals.hasDistanceGoal
    ? Math.max(goals.totalDistanceMeters - progress.distanceMeters, 0)
    : 0;
  const remainingTime = goals.hasTimeGoal
    ? Math.max(goals.totalTimeSeconds - progress.elapsedSeconds, 0)
    : 0;

  const allMet = remainingDistance === 0 && remainingTime === 0 &&
    (goals.hasDistanceGoal || goals.hasTimeGoal);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <Pressable style={[styles.closeX, { top: insets.top }]} onPress={dismiss} hitSlop={16}>
        <X size={24} color={colors.backgroundTertiary} />
      </Pressable>

      <View style={styles.iconContainer}>
        <TreePine size={48} color={colors.meadowGreen} />
      </View>

      <Typography variant="heading" style={styles.title}>
        {allMet ? 'Goal Reached!' : 'App Blocked'}
      </Typography>

      <Typography variant="body" style={styles.message}>
        {allMet ? 'Congratulations! You made it!' : message}
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
        {!allMet && (remainingDistance > 0 || remainingTime > 0) && (
          <>
            <View style={styles.divider} />
            <Typography variant="body" style={styles.remaining}>
              {remainingDistance > 0 && `${formatDistance(remainingDistance)} `}
              {remainingDistance > 0 && remainingTime > 0 && '& '}
              {remainingTime > 0 && `${formatTime(remainingTime)} `}
              remaining
            </Typography>
          </>
        )}
      </View>

      <Pressable style={styles.closeButton} onPress={dismiss}>
        <Typography variant="body" style={styles.closeButtonText}>
          Close
        </Typography>
      </Pressable>
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
  closeX: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: spacing.lg,
  },
  closeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.backgroundTertiary,
  },
  closeButtonText: {
    color: colors.backgroundTertiary,
    textAlign: 'center',
  },
});
