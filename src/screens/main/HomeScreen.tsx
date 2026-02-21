import { useState, useEffect } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Footprints, Play, Shield, Square } from 'lucide-react-native';
import { Typography } from '../../components';
import { ProgressRing } from '../../components/ProgressRing';
import { useTracking, AggregatedGoals } from '../../hooks/useTracking';
import { TrackingProgress } from '../../tracking/Tracking';
import { AppBlocker } from '../../native/AppBlocker';
import { colors, spacing } from '../../theme';

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

function formatDistance(meters: number, totalMeters: number): string {
  const formatValue = (m: number) =>
    m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
  return `${formatValue(meters)} / ${formatValue(totalMeters)}`;
}

function formatTime(seconds: number, totalSeconds: number): string {
  const formatValue = (s: number) => {
    if (s < 60) return `${Math.round(s)}s`;
    const min = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return sec > 0 && s < 3600 ? `${min}m ${sec}s` : `${min}min`;
  };
  return `${formatValue(seconds)} / ${formatValue(totalSeconds)}`;
}

export const HomeScreen = () => {
  const {
    isTracking,
    progress,
    activePlans,
    goals,
    allGoalsReached,
    permissionsGranted,
    backgroundTrackingEnabled,
    debugInfo,
    startManual,
    stop,
    toggleBackgroundTracking,
  } = useTracking();

  const fraction = getOverallFraction(goals, progress);
  const hasPlans = activePlans.length > 0;

  // In background-tracking mode the play button is hidden — the service handles start/stop.
  // In manual mode it's available whenever there are plans and goals aren't met.
  const showPlayButton =
    hasPlans && !allGoalsReached && !backgroundTrackingEnabled;

  const motionMode = isTracking ? 'moving' : 'idle';

  // Motion detected = MotionEngine sees movement but GPS session not yet started.
  // Provides instant feedback (< 500ms) before the first TrackingService progress event.
  const isMotionDetected = debugInfo.motionState === 'MOVING';

  const statusText = !hasPlans
    ? 'No active plan for today'
    : allGoalsReached
    ? 'Goal reached! Apps unlocked'
    : backgroundTrackingEnabled
    ? isTracking
      ? 'Activity detected, automatically tracking'
      : isMotionDetected
      ? 'Motion detected, acquiring GPS...'
      : 'Watching for movement...'
    : isTracking
    ? "Keep going! You're making progress"
    : 'Start walking to earn screen time';

  const footprintActive = backgroundTrackingEnabled && permissionsGranted;

  const [blockerPermsGranted, setBlockerPermsGranted] = useState(false);

  useEffect(() => {
    const check = async () => {
      const hasUsage = await AppBlocker.hasUsageStatsPermission();
      const hasOverlay = await AppBlocker.hasOverlayPermission();
      setBlockerPermsGranted(hasUsage && hasOverlay);
    };
    check();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  const requestBlockerPermissions = async () => {
    const hasUsage = await AppBlocker.hasUsageStatsPermission();
    if (!hasUsage) {
      await AppBlocker.requestUsageStatsPermission();
      return;
    }
    const hasOverlay = await AppBlocker.hasOverlayPermission();
    if (!hasOverlay) {
      await AppBlocker.requestOverlayPermission();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.scroll}>
      <ProgressRing progress={fraction} size={220} strokeWidth={14} />

      {hasPlans && (
        <View style={styles.progressInfo}>
          {goals.hasDistanceGoal && (
            <Typography variant="title" style={styles.progressText}>
              {formatDistance(
                progress.distanceMeters,
                goals.totalDistanceMeters,
              )}
            </Typography>
          )}
          {goals.hasTimeGoal && (
            <Typography variant="title" style={styles.progressText}>
              {formatTime(progress.elapsedSeconds, goals.totalTimeSeconds)}
            </Typography>
          )}
        </View>
      )}

      <Typography variant="body" style={styles.statusText}>
        {statusText}
      </Typography>

      <View style={styles.buttonRow}>
        {showPlayButton && (
          <Pressable
            style={styles.actionButton}
            onPress={isTracking ? stop : startManual}
            hitSlop={12}
          >
            {isTracking ? (
              <Square size={20} color={colors.white} fill={colors.white} />
            ) : (
              <Play size={20} color={colors.white} fill={colors.white} />
            )}
          </Pressable>
        )}
        <Pressable
          style={[
            styles.actionButton,
            footprintActive
              ? styles.actionButtonActive
              : styles.actionButtonHighlight,
          ]}
          onPress={toggleBackgroundTracking}
          hitSlop={12}
        >
          <Footprints size={20} color={colors.white} />
        </Pressable>
        {!blockerPermsGranted && (
          <Pressable
            style={[styles.actionButton, styles.actionButtonHighlight]}
            onPress={requestBlockerPermissions}
            hitSlop={12}
          >
            <Shield size={20} color={colors.white} />
          </Pressable>
        )}
      </View>

      <View style={styles.debugPanel}>
        <Typography variant="body" style={styles.debugTitle}>
          DEBUG
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          isTracking: {String(isTracking)} | mode: {motionMode}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          goalsReached: {String(allGoalsReached)}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          Current motion: {debugInfo.currentActivity.toUpperCase()}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          Step detected: {String(debugInfo.stepDetected)}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          GPS: {String(debugInfo.gpsActive)}
        </Typography>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  progressInfo: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  progressText: {
    color: colors.white,
  },
  statusText: {
    color: colors.backgroundTertiary,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.meadowGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: colors.meadowGreen,
  },
  actionButtonHighlight: {
    backgroundColor: colors.terracotta,
  },
  debugPanel: {
    width: '100%',
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    gap: 2,
  },
  debugTitle: {
    color: colors.terracotta,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  debugText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  debugWarn: {
    color: colors.terracotta,
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },
});
