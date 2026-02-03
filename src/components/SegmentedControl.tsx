import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';
import { triggerHaptic } from '../utils/haptics';

export interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export const SegmentedControl = ({
  options,
  selectedIndex,
  onSelect,
}: SegmentedControlProps) => {
  const handleSelect = (index: number) => {
    triggerHaptic('selection');
    onSelect(index);
  };

  return (
    <View style={styles.segmentedContainer}>
      {options.map((option, index) => (
        <Pressable
          key={option}
          style={[
            styles.segmentedOption,
            selectedIndex === index && styles.segmentedOptionSelected,
          ]}
          onPress={() => handleSelect(index)}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text
            style={[
              styles.segmentedText,
              selectedIndex === index && styles.segmentedTextSelected,
            ]}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.gray200,
    borderRadius: borderRadius.pill,
    padding: 1,
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: spacing.xxs,
    maxWidth: spacing.xl * 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.pill,
  },
  segmentedOptionSelected: {
    backgroundColor: colors.primary.blue,
  },
  segmentedText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  segmentedTextSelected: {
    color: colors.neutral.white,
    fontWeight: '600',
  },
});

export default SegmentedControl;
