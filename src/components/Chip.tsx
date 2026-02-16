import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, borderRadius, spacing, fontSizes } from '../theme';

export type ChipVariant = 'primary' | 'secondary';
export type ChipColor = 'blue' | 'green' | 'red';

const chipColors: Record<ChipColor, string> = {
  blue: colors.skyBlue,
  green: colors.meadowGreen,
  red: colors.terracotta,
};

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  color?: ChipColor;
  onPress?: () => void;
}

export const Chip = ({ label, variant = 'primary', color, onPress }: ChipProps) => {
  const backgroundColor = color
    ? chipColors[color]
    : variant === 'primary'
      ? colors.skyBlue
      : colors.backgroundTertiary;

  return (
    <Pressable
      style={[styles.container, { backgroundColor }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.black,
    fontSize: fontSizes.xxs,
    fontWeight: '500',
  },
});

export default Chip;
