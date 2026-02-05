import { Image, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../theme';

export interface AppIconProps {
  name: string;
  /** Time to display (e.g., "2h 30m") */
  time?: string;
  /** Generic label to display below icon (used if time not provided) */
  label?: string;
  /** Base64-encoded PNG app icon */
  icon?: string;
}

export const AppIcon = ({ name, time, label, icon }: AppIconProps) => {
  const displayLabel = time ?? label ?? name;

  return (
    <View style={appStyles.appItem}>
      <View style={[appStyles.iconContainer]}>
        {icon ? (
          <Image
            source={{
              uri: icon.startsWith('data:')
                ? icon
                : `data:image/png;base64,${icon}`,
            }}
            style={appStyles.iconImage}
          />
        ) : (
          <Text style={typography.styles.light.body}>
            {name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <Text style={typography.styles.light.small} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
};

const appStyles = StyleSheet.create({
  appItem: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 52,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
});
