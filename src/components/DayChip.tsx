import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../theme';

export interface DayChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

export const DayChip = ({ label, isSelected, onPress }: DayChipProps) => {
  const simpleLabel = label[0];
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.dayChip, isSelected && styles.dayChipSelected]}
        onPress={onPress}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text
          style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}
        >
          {simpleLabel}
        </Text>
      </Pressable>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
  dayChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.neutral.white,
    borderWidth: 1.5,
    borderColor: colors.neutral.gray200,
    minWidth: 42,
    alignItems: 'center',
  },
  dayChipSelected: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  dayChipText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  dayChipTextSelected: {
    color: colors.neutral.white,
    fontWeight: '600',
  },
  label: {
    ...typography.styles.dark.caption,
    textAlign: 'center',
  },
});

export default DayChip;
