import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors, spacing } from '../theme';

export interface BlockedApp {
  name: string;
  icon?: string;
}

export interface AppBlockListProps {
  apps: BlockedApp[];
  onEdit?: () => void;
}

const GREEN = '#4ADE00';

export const AppBlockList = ({ apps, onEdit }: AppBlockListProps) => {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>BLOCK LIST</Text>
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onEdit}
        >
          <Text style={styles.editButtonText}>EDIT</Text>
        </Pressable>
      </View>
      <View style={styles.appIconsRow}>
        {apps.map(app => (
          <AppIcon
            key={app.name}
            name={app.name}
            label={app.name}
            icon={app.icon}
          />
        ))}
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
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: GREEN,
    letterSpacing: 0.5,
  },
  appIconsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
