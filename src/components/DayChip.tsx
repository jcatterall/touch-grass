import { Pressable, StyleSheet, View } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';
import { Typography } from './Typography';

export interface DayChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

export const DayChip = ({
  label,
  isSelected,
  onPress,
}: DayChipProps) => {
  const simpleLabel = label[0];

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.dayChip,
          isSelected && styles.dayChipSelected,
        ]}
        onPress={onPress}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Typography
          variant="body"
          style={[
            styles.dayChipText,
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
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.charcoal,
    minWidth: 42,
    alignItems: 'center',
  },
  dayChipSelected: {
    backgroundColor: colors.skyBlue,
    borderColor: colors.skyBlue,
  },
  dayChipText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.white,
  },
  dayChipTextSelected: {
    color: colors.black,
    fontWeight: '600',
  },
});

export default DayChip;
