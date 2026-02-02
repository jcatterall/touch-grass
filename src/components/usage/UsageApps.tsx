import { StyleSheet, Text, View } from 'react-native';
import { AppUsage } from '../../native/UsageStats';
import { borderRadius, colors, spacing, typography } from '../../theme/tokens';
import { AppIcon } from '../AppIcon';

export const UsageApps = ({ apps }: { apps: AppUsage[] }) => {
  const displayApps = apps.slice(0, 6);

  if (displayApps.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={typography.styles.light.title}>Most used</Text>
        <Text style={styles.emptyText}>No app usage data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={typography.styles.dark.subheading}>Most used apps</Text>
      <View style={styles.appsRow}>
        {displayApps.map((app, index) => (
          <AppIcon
            key={`${app.packageName}-${index}`}
            name={app.name}
            time={app.time}
            icon={app.icon}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  emptyText: {
    ...typography.styles.dark.caption,
    color: colors.dark.textSecondary,
  },
  appsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
