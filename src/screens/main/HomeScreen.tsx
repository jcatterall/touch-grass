import { Pressable, StyleSheet, View } from 'react-native';
import { Footprints, Play, Square } from 'lucide-react-native';
import { Typography } from '../../components';
import { ProgressRing } from '../../components/ProgressRing';
import { useTracking } from '../../hooks/useTracking';
import { TrackingPermissions } from '../../native/Permissions';
import { ActivityRecognition } from '../../native/ActivityRecognition';
import { colors, spacing } from '../../theme';

function getProgressFraction(
  activePlan: ReturnType<typeof useTracking>['activePlan'],
  progress: ReturnType<typeof useTracking>['progress'],
): number {
  if (!activePlan) return 0;
  const { criteria } = activePlan;

  if (criteria.type === 'distance') {
    const goalMeters =
      criteria.unit === 'mi'
        ? criteria.value * 1609.34
        : criteria.value * 1000;
    return Math.min(progress.distanceMeters / goalMeters, 1);
  }
  if (criteria.type === 'time') {
    const goalSeconds = criteria.value * 60;
    return Math.min(progress.elapsedSeconds / goalSeconds, 1);
  }
  return 0;
}

function getProgressText(
  activePlan: ReturnType<typeof useTracking>['activePlan'],
  progress: ReturnType<typeof useTracking>['progress'],
): string {
  if (!activePlan) return '';
  const { criteria } = activePlan;

  if (criteria.type === 'distance') {
    const distKm = progress.distanceMeters / 1000;
    if (criteria.unit === 'mi') {
      const distMi = progress.distanceMeters / 1609.34;
      return `${distMi.toFixed(1)}mi / ${criteria.value}mi`;
    }
    return `${distKm.toFixed(1)}km / ${criteria.value}km`;
  }
  if (criteria.type === 'time') {
    const elapsedMin = Math.floor(progress.elapsedSeconds / 60);
    return `${elapsedMin}min / ${criteria.value}min`;
  }
  return '';
}

export const HomeScreen = () => {
  const { isTracking, progress, activePlan, permissionsGranted, startManual, stop } =
    useTracking();

  const fraction = getProgressFraction(activePlan, progress);
  const progressText = getProgressText(activePlan, progress);

  const statusText = !activePlan
    ? 'No active plan for today'
    : progress.goalReached
      ? 'Goal reached! Apps unlocked'
      : isTracking
        ? "Keep going! You're making progress"
        : 'Start walking to earn screen time';

  return (
    <View style={styles.container}>
      <ProgressRing progress={fraction} size={220} strokeWidth={14} />

      {activePlan && (
        <Typography variant="title" style={styles.progressText}>
          {progressText}
        </Typography>
      )}

      <Typography variant="body" style={styles.statusText}>
        {statusText}
      </Typography>

      <View style={styles.buttonRow}>
        {activePlan && !progress.goalReached && (
          <Pressable
            style={styles.actionButton}
            onPress={isTracking ? stop : startManual}
            hitSlop={12}>
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
            !permissionsGranted && styles.actionButtonHighlight,
          ]}
          onPress={async () => {
            const granted = await TrackingPermissions.requestAll();
            if (granted) {
              await ActivityRecognition.start();
            }
          }}
          hitSlop={12}>
          <Footprints size={20} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  progressText: {
    color: colors.white,
    marginTop: spacing.md,
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
  actionButtonHighlight: {
    backgroundColor: colors.terracotta,
  },
});
