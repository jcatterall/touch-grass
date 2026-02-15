import { Image, StyleSheet, View } from 'react-native';
import Typography from '../Typography';
import { BlockedApp } from './PlanBlockList';
import { borderRadius, colors, spacing } from '../../theme';

export interface PlanAppsProps {
  apps: BlockedApp[];
}

export const PlanApps = ({ apps }: PlanAppsProps) => {
  const displayedApps = apps.slice(0, 4);
  const isSingle = apps.length === 1;
  const remainingCount = apps.length - 1;

  return (
    <View style={styles.row}>
      <View style={[styles.grid, isSingle && styles.gridSingle]}>
        {displayedApps.map(app => (
          <View
            key={app.name}
            style={[
              styles.iconWrap,
              isSingle ? styles.iconSingle : styles.iconGrid,
            ]}
          >
            {app.icon ? (
              <Image
                source={{
                  uri: app.icon.startsWith('data:')
                    ? app.icon
                    : `data:image/png;base64,${app.icon}`,
                }}
                style={styles.iconImage}
              />
            ) : (
              <Typography variant="subtitle">
                {app.name.charAt(0).toUpperCase()}
              </Typography>
            )}
          </View>
        ))}
      </View>
      <View style={styles.labelGroup}>
        <Typography variant="subtitle">{apps[0].name}</Typography>
        {remainingCount > 0 && (
          <Typography variant="body" color="tertiary">
            & {remainingCount} other{remainingCount > 1 ? 's' : ''}
          </Typography>
        )}
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 18 * 2 + 4,
    height: 18 * 2 + 4,
    gap: 4,
    overflow: 'hidden',
  },
  gridSingle: {
    width: 18 * 2 + 4,
    height: 18 * 2 + 4,
    gap: 0,
  },
  iconWrap: {
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.charcoal,
  },
  iconSingle: {
    width: 18 * 2 + 4,
    height: 18 * 2 + 4,
  },
  iconGrid: {
    width: 18,
    height: 18,
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
});
