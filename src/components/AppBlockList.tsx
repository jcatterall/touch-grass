import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors, spacing, typography } from '../theme';
import Button from './Button';

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
  const displayedApps = apps.slice(0, 4);
  const remainingCount = apps.length - displayedApps.length;
  const hasRemaining = remainingCount > 0;
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>BLOCK LIST</Text>
        <Button onPress={onEdit} variant="link">
          EDIT
        </Button>
      </View>
      <View style={styles.appIconRowContainer}>
        {hasApps ? (
          <View style={styles.appIconsRow}>
            {displayedApps.map(app => (
              <AppIcon
                key={app.name}
                name={app.name}
                label={app.name}
                icon={app.icon}
              />
            ))}
            {hasRemaining && (
              <View style={styles.moreApps}>
                <Text style={typography.styles.light.subheading}>
                  {remainingCount}+
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={typography.styles.light.body}>No apps</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 1,
  },
  appIconRowContainer: {
    backgroundColor: colors.neutral.gray100,
    padding: spacing.md,
    borderRadius: 8,
    minHeight: 80,
  },
  appIconsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  moreApps: {
    justifyContent: 'center',
    alignContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
});
