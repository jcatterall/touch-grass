import { StyleSheet, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { borderRadius, colors, spacing } from '../theme';
import { Typography } from './Typography';
import Button from './Button';
import { Illustration } from './Illustration';

export interface BlockedApp {
  name: string;
  icon?: string;
}

export interface AppBlockListProps {
  apps: BlockedApp[];
  onEdit?: () => void;
}

export const AppBlockList = ({ apps, onEdit }: AppBlockListProps) => {
  const hasApps = apps.length > 0;
  const displayedApps = apps.slice(0, 5);
  const remainingCount = apps.length - displayedApps.length;
  const hasRemaining = remainingCount > 0;
  return (
    <View>
      {hasApps && (
        <View style={styles.header}>
          <Typography
            mode="light"
            variant="body"
            color="inverse"
            style={styles.sectionLabel}
          >
            Blocked Apps
          </Typography>
          <Button
            onPress={onEdit}
            variant="link"
            textStyle={{ color: colors.neutral.white }}
          >
            Edit
          </Button>
        </View>
      )}
      {hasApps ? (
        <View style={styles.appIconRowContainer}>
          <View style={styles.appIconsRow}>
            {displayedApps.map(app => (
              <AppIcon key={app.name} name={app.name} icon={app.icon} />
            ))}
            {hasRemaining && (
              <View style={styles.moreApps}>
                <Typography mode="dark" variant="subtitle">
                  {remainingCount}+
                </Typography>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.chooseApps}>
          <Illustration source="chest" size="xxs" />

          <View>
            <Button mode="dark" variant="secondary" onPress={onEdit}>
              Choose blocked apps
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  chooseApps: {
    justifyContent: 'center',
    alignContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionLabel: {
    letterSpacing: 1,
  },
  appIconRowContainer: {
    borderRadius: borderRadius.md,
    minHeight: 80,
  },
  appIconsRow: {
    flexDirection: 'row',
  },
  moreApps: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignContent: 'center',
    flex: 1,
  },
});
