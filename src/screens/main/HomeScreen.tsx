import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Footprints, Play, Shield, Square } from 'lucide-react-native';
import { ConfirmModal, Typography } from '../../components';
import { ProgressRing } from '../../components/ProgressRing';
import { useTracking, AggregatedGoals } from '../../hooks/useTracking';
import { TrackingProgress } from '../../tracking/Tracking';
import {
  AppBlocker,
  EmergencyUnblockMode,
  EmergencyUnblockStatus,
} from '../../native/AppBlocker';
import { colors, spacing } from '../../theme';
import { triggerHaptic } from '../../utils';

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

function formatTrackingBlockedReason(reason: string | null): string {
  if (!reason) return 'unknown reason';
  switch (reason) {
    case 'location_permission_missing_or_tracking_rejected':
      return 'location permission unavailable';
    case 'activity_not_active':
      return 'eligible activity not active';
    case 'activity_not_eligible':
      return 'activity is not walking/running/cycling';
    case 'idle_monitoring_disabled':
      return 'background tracking disabled';
    case 'stale_activity_latch':
      return 'activity signal became stale';
    case 'tracking_sink_error':
      return 'native tracking start failed';
    default:
      return reason.replace(/_/g, ' ');
  }
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
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
  // In manual mode it's available whenever there are active plans, including after goals
  // are met so the user can continue with a bonus walk.
  const showPlayButton = hasPlans && !backgroundTrackingEnabled;

  const motionMode = isTracking ? 'moving' : 'idle';

  // Motion detected = MotionEngine sees movement but GPS session not yet started.
  // Provides instant feedback (< 500ms) before the first TrackingService progress event.
  const isMotionDetected = debugInfo.motionState === 'MOVING';

  // Actively tracking = GPS session running AND motion state confirms we're still moving.
  // This prevents the "automatically tracking" message from showing during the 5-second
  // stationary buffer drain window after the user stops (isTracking stays true briefly).
  const isActivelyTracking = isTracking && isMotionDetected;
  const blockedReasonText = formatTrackingBlockedReason(
    debugInfo.trackingBlockedReason,
  );

  const statusText = !hasPlans
    ? 'No active plan for today'
    : allGoalsReached
    ? isTracking
      ? 'Bonus walk in progress'
      : 'Goal reached! Apps unlocked'
    : backgroundTrackingEnabled
    ? isActivelyTracking
      ? 'Activity detected, automatically tracking'
      : isMotionDetected
      ? debugInfo.trackingBlockedReason
        ? `Motion detected, tracking blocked: ${blockedReasonText}`
        : 'Motion detected, acquiring GPS...'
      : 'Watching for movement...'
    : isTracking
    ? "Keep going! You're making progress"
    : 'Start walking to earn screen time';

  const footprintActive = backgroundTrackingEnabled && permissionsGranted;

  const [blockerPermsGranted, setBlockerPermsGranted] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyStatus, setEmergencyStatus] =
    useState<EmergencyUnblockStatus>({
      active: false,
      mode: 'none',
      untilMs: 0,
      remainingMs: 0,
    });
  const emergencyActive = emergencyStatus.active;

  const refreshEmergencyStatus = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const status = await AppBlocker.getEmergencyUnblockStatus();
    setEmergencyStatus(status);
  }, []);

  useEffect(() => {
    const check = async () => {
      const hasUsage = await AppBlocker.hasUsageStatsPermission();
      const hasOverlay = await AppBlocker.hasOverlayPermission();
      const hasNotificationListener =
        await AppBlocker.hasNotificationListenerPermission();
      setBlockerPermsGranted(hasUsage && hasOverlay && hasNotificationListener);
    };
    check();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        check();
        refreshEmergencyStatus();
      }
    });
    return () => sub.remove();
  }, [refreshEmergencyStatus]);

  useEffect(() => {
    refreshEmergencyStatus();
  }, [refreshEmergencyStatus]);

  useEffect(() => {
    if (!emergencyActive) return;
    const timer = setInterval(() => {
      refreshEmergencyStatus();
    }, 1000);
    return () => clearInterval(timer);
  }, [emergencyActive, refreshEmergencyStatus]);

  const requestBlockerPermissions = async () => {
    const hasUsage = await AppBlocker.hasUsageStatsPermission();
    if (!hasUsage) {
      await AppBlocker.requestUsageStatsPermission();
      return;
    }
    const hasOverlay = await AppBlocker.hasOverlayPermission();
    if (!hasOverlay) {
      await AppBlocker.requestOverlayPermission();
      return;
    }
    const hasNotificationListener =
      await AppBlocker.hasNotificationListenerPermission();
    if (!hasNotificationListener) {
      await AppBlocker.requestNotificationListenerPermission();
    }
  };

  const startEmergencyUnblock = async (
    mode: EmergencyUnblockMode,
    durationMs: number,
  ) => {
    if (Platform.OS !== 'android') return;
    const nextStatus = await AppBlocker.startEmergencyUnblock(mode, durationMs);
    setEmergencyStatus(nextStatus);
    if (nextStatus.active) {
      triggerHaptic('selection');
    }
  };

  const reactivateBlocking = async () => {
    if (Platform.OS !== 'android') return;
    await AppBlocker.clearEmergencyUnblock();
    await refreshEmergencyStatus();
  };

  const emergencyStatusText =
    emergencyStatus.mode === 'today'
      ? 'Today'
      : formatCountdown(emergencyStatus.remainingMs);

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

      {Platform.OS === 'android' && (
        <View style={styles.emergencyRow}>
          {emergencyActive ? (
            <Pressable
              style={styles.emergencyButton}
              onPress={reactivateBlocking}
              hitSlop={12}
            >
              <Typography variant="body" style={styles.emergencyButtonText}>
                Reactivate blocking
              </Typography>
            </Pressable>
          ) : (
            <Pressable
              style={styles.emergencyButton}
              onPress={() => setShowEmergencyModal(true)}
              hitSlop={12}
            >
              <Typography variant="body" style={styles.emergencyButtonText}>
                Emergency Unblock
              </Typography>
            </Pressable>
          )}
          {emergencyActive && (
            <Typography variant="body" style={styles.emergencyCountdownText}>
              {emergencyStatusText}
            </Typography>
          )}
        </View>
      )}

      <ConfirmModal
        visible={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        title="Emergency Unblock"
        subtitle="Choose how long to unblock apps"
        cancelLabel="Cancel"
        actions={[
          {
            label: '5 minutes',
            onPress: () =>
              startEmergencyUnblock(
                '5m',
                AppBlocker.EMERGENCY_UNBLOCK_DURATION_5M_MS,
              ),
            variant: 'secondary',
          },
          {
            label: '30 minutes',
            onPress: () =>
              startEmergencyUnblock(
                '30m',
                AppBlocker.EMERGENCY_UNBLOCK_DURATION_30M_MS,
              ),
            variant: 'secondary',
          },
          {
            label: 'Today',
            onPress: () => startEmergencyUnblock('today', 0),
            variant: 'secondary',
          },
        ]}
      />

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
          Motion state: {debugInfo.motionState}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          Tracking blocked: {debugInfo.trackingBlockedReason ?? 'none'}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          Activity: {debugInfo.currentActivity.toUpperCase()}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          Step detected: {String(debugInfo.stepDetected)} | GPS:{' '}
          {String(debugInfo.gpsActive)}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          Variance: {debugInfo.variance.toFixed(4)}
        </Typography>
        <Typography variant="body" style={styles.debugText}>
          Cadence: {debugInfo.cadence.toFixed(2)} steps/sec
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
  emergencyRow: {
    alignItems: 'center',
    gap: spacing.xs,
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
  emergencyButton: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  emergencyCountdownText: {
    color: colors.backgroundTertiary,
    fontWeight: '600',
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
