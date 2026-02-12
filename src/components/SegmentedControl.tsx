import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';
import { triggerHaptic } from '../utils/haptics';

type SegmentedControlSize = 'sm' | 'md';

export interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  size?: SegmentedControlSize;
}

export const SegmentedControl = ({
  options,
  selectedIndex,
  onSelect,
  size = 'md',
}: SegmentedControlProps) => {
  const handleSelect = (index: number) => {
    triggerHaptic('selection');
    onSelect(index);
  };

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.segmentedContainer,
        isSmall && styles.segmentedContainerSm,
      ]}
    >
      {options.map((option, index) => (
        <Pressable
          key={option}
          style={[
            styles.segmentedOption,
            isSmall && styles.segmentedOptionSm,
            selectedIndex === index && styles.segmentedOptionSelected,
          ]}
          onPress={() => handleSelect(index)}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text
            style={[
              styles.segmentedText,
              isSmall && styles.segmentedTextSm,
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
    backgroundColor: colors.charcoal,
    borderRadius: borderRadius.pill,
    padding: 2,
    alignSelf: 'flex-start',
  },
  segmentedContainerSm: {
    padding: 2,
  },
  segmentedOption: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.pill,
  },
  segmentedOptionSm: {
    paddingVertical: spacing.xxxs,
    paddingHorizontal: spacing.sm,
  },
  segmentedOptionSelected: {
    backgroundColor: colors.skyBlue,
  },
  segmentedText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.oatmeal,
  },
  segmentedTextSm: {
    fontSize: 13,
  },
  segmentedTextSelected: {
    color: colors.black,
    fontWeight: '600',
  },
});

export default SegmentedControl;
