import { Pressable, StyleSheet, View } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';
import { Typography } from './Typography';

export interface DayChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  mode?: 'light' | 'dark';
}

export const DayChip = ({
  label,
  isSelected,
  onPress,
  mode = 'light',
}: DayChipProps) => {
  const simpleLabel = label[0];
  const isDark = mode === 'dark';

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.dayChip,
          isDark && styles.dayChipDark,
          isSelected && styles.dayChipSelected,
        ]}
        onPress={onPress}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Typography
          variant="body"
          style={[
            styles.dayChipText,
            isDark && styles.dayChipTextDark,
            isSelected && styles.dayChipTextSelected,
          ]}
        >
          {simpleLabel}
        </Typography>
      </Pressable>
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
  dayChipDark: {
    backgroundColor: colors.dark70,
    borderColor: colors.dark50,
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
  dayChipTextDark: {
    color: colors.dark.textSecondary,
  },
  dayChipTextSelected: {
    color: colors.neutral.black,
    fontWeight: '600',
  },
  label: {
    textAlign: 'center',
  },
});

export default DayChip;
