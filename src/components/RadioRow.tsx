import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';

export interface RadioRowProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

export const RadioRow = ({ label, isSelected, onPress }: RadioRowProps) => (
  <Pressable
    style={styles.radioRow}
    onPress={onPress}
    hitSlop={{ top: 4, bottom: 4 }}
  >
    <Text style={styles.radioLabel}>{label}</Text>
    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
      {isSelected && <View style={styles.radioInner} />}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.white,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text.primary,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary.blue,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary.blue,
  },
});

export default RadioRow;
