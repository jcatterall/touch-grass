import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { borderRadius, colors, spacing } from '../theme';

export type CardVariant = 'primary' | 'secondary';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onClose?: () => void;
  variant?: CardVariant;
  style?: ViewStyle;
}

export const Card = ({
  children,
  onPress,
  onClose,
  variant = 'primary',
  style,
}: CardProps) => {
  const content = (
    <View
      style={[styles.card, variant === 'secondary' && styles.secondary, style]}
    >
      <View style={styles.content}>{children}</View>
      {onClose && (
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={18} color={colors.white} />
        </Pressable>
      )}
      {!onClose && onPress && <ChevronRight size={20} color={colors.white} />}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.backgroundSecondary,
  },
  content: {
    flex: 1,
  },
});
