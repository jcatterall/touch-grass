import { StyleSheet, View } from 'react-native';
import { AppUsage } from '../../native/UsageStats';
import { borderRadius, spacing } from '../../theme/tokens';
import { AppIcon } from '../AppIcon';
import { Typography } from '../Typography';

export const UsageApps = ({ apps }: { apps: AppUsage[] }) => {
  const displayApps = apps.slice(0, 5);

  if (displayApps.length === 0) {
    return (
      <View style={styles.container}>
        <Typography mode="light" variant="title">
          Most used
        </Typography>
        <Typography variant="body" color="secondary">
          No app usage data available
        </Typography>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Typography mode="dark" variant="subtitle">
        Most used apps
      </Typography>
      <View style={styles.appsRow}>
        {displayApps.map((app, index) => (
          <AppIcon
            key={`${app.packageName}-${index}`}
            name={app.name}
            label={app.time}
            icon={app.icon}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  appsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
