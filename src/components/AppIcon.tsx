import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

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
  const bgColor = appIconColors[name] || colors.dark.surface;
  const displayLabel = time ?? label ?? name;

  return (
    <View style={appStyles.appItem}>
      <View
        style={[appStyles.iconContainer, !icon && { backgroundColor: bgColor }]}
      >
        {icon ? (
          <Image
            source={{ uri: `data:image/png;base64,${icon}` }}
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
    backgroundColor: colors.dark.surface,
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

// Fallback colors for apps when icon is not available
const appIconColors: Record<string, string> = {
  YouTube: '#FF0000',
  Instagram: '#E4405F',
  Spotify: '#1DB954',
  'Google Maps': '#4285F4',
  Maps: '#4285F4',
  Notes: '#FFCC00',
  Phone: '#007AFF',
  Chrome: '#4285F4',
  'Google Chrome': '#4285F4',
  WhatsApp: '#25D366',
  Facebook: '#1877F2',
  Twitter: '#1DA1F2',
  X: '#000000',
  TikTok: '#000000',
  Snapchat: '#FFFC00',
  Netflix: '#E50914',
  Telegram: '#0088CC',
  Discord: '#5865F2',
  Slack: '#4A154B',
  Gmail: '#EA4335',
  Messages: '#34C759',
  Settings: '#8E8E93',
  Camera: '#FFD60A',
  Photos: '#FF2D55',
  Safari: '#0078FF',
  'App Store': '#0D84FF',
  Music: '#FC3C44',
  Podcasts: '#9933FF',
  Clock: '#FF9500',
  Calendar: '#FF3B30',
};
