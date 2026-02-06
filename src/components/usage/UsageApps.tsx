import { StyleSheet, View } from 'react-native';
import { AppUsage } from '../../native/UsageStats';
import { borderRadius, colors, spacing } from '../../theme/tokens';
import { AppIcon } from '../AppIcon';
import { Typography } from '../Typography';

export const UsageApps = ({ apps }: { apps: AppUsage[] }) => {
  const displayApps = apps.slice(0, 6);

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
      <Typography mode="light" variant="subtitle">
        Most used apps
      </Typography>
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
    backgroundColor: colors.neutral10,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  appsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
