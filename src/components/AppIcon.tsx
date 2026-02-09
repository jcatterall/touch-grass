import { Image, StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { Typography } from './Typography';

export interface AppIconProps {
  name: string;
  icon?: string;
  label?: string;
}

export const AppIcon = ({ name, icon, label }: AppIconProps) => {
  return (
    <View style={appStyles.appItem}>
      {/* Icon Wrapper */}
      <View style={appStyles.iconContainer}>
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
          <Typography mode="dark" variant="subtitle">
            {name.charAt(0).toUpperCase()}
          </Typography>
        )}
      </View>

      {/* Label moved outside the container */}
      {label && (
        <Typography mode="dark" variant="link" style={appStyles.label}>
          {label}
        </Typography>
      )}
    </View>
  );
};

const appStyles = StyleSheet.create({
  appItem: {
    alignItems: 'center',
    // Gap handles the spacing between the icon and the label
    gap: spacing.xs,
    width: 60, // Increased width slightly to prevent text wrapping too early
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },
  label: {
    textAlign: 'center',
  },
});
