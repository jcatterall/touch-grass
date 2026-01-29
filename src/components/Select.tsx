/**
 * Select - Headspace Design System Selection List Component
 *
 * A production-ready, reusable selection list component.
 * Built with FlatList for performance optimization.
 *
 * Features:
 * - Single-select (Radio) and Multi-select (Checkbox) modes
 * - Two variants: blue, orange (Headspace brand colors)
 * - Light/Dark mode support
 * - Controlled component pattern (parent manages state)
 * - Haptic feedback on selection
 * - Full accessibility support
 * - Custom renderItem support
 * - FlatList-based for optimal performance with large lists
 */

import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  SelectSizes,
  type HSColorMode,
  type SelectVariant,
} from '../theme/theme';
import { SelectionRow, type SelectionRowProps } from './SelectionRow';

// =============================================================================
// TYPES
// =============================================================================

export interface SelectOption {
  /** Display label for the option */
  label: string;

  /** Unique value for the option */
  value: string | number;

  /** Whether this option is disabled */
  disabled?: boolean;
}

export interface SelectProps {
  /** Array of options to display */
  options: SelectOption[];

  /** Currently selected value (single-select) or values (multi-select) */
  value: (string | number) | (string | number)[];

  /** Whether to allow multiple selections */
  multiSelect?: boolean;

  /** Callback when selection changes */
  onValueChange: (value: (string | number) | (string | number)[]) => void;

  /** Color variant */
  variant?: SelectVariant;

  /** Color mode - light or dark theme */
  mode?: HSColorMode;

  /** Whether to enable haptic feedback on selection */
  hapticEnabled?: boolean;

  /** Gap between list items */
  itemGap?: number;

  /** Custom render function for list items */
  renderItem?: (props: CustomRenderItemProps) => React.ReactElement;

  /** Container style */
  style?: StyleProp<ViewStyle>;

  /** Content container style for FlatList */
  contentContainerStyle?: StyleProp<ViewStyle>;

  /** Whether the entire list is disabled */
  disabled?: boolean;

  /** Test ID prefix for testing */
  testID?: string;

  /** Accessibility label for the list */
  accessibilityLabel?: string;
}

export interface CustomRenderItemProps {
  /** The option data */
  option: SelectOption;

  /** Whether this option is selected */
  isSelected: boolean;

  /** Handler to call when this item is pressed */
  onPress: () => void;

  /** Whether this option is disabled */
  disabled: boolean;

  /** The index of this item in the list */
  index: number;

  /** Default SelectionRow props for convenience */
  defaultRowProps: Omit<SelectionRowProps, 'onPress'>;
}

// =============================================================================
// SELECT COMPONENT
// =============================================================================

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  multiSelect = false,
  onValueChange,
  variant = 'blue',
  mode = 'light',
  hapticEnabled = true,
  itemGap = 12,
  renderItem: customRenderItem,
  style,
  contentContainerStyle,
  disabled = false,
  testID,
  accessibilityLabel,
}) => {
  // ==========================================================================
  // SELECTION LOGIC
  // ==========================================================================

  const selectedValues = useMemo((): Set<string | number> => {
    if (multiSelect) {
      return new Set(Array.isArray(value) ? value : [value]);
    }
    return new Set([value as string | number]);
  }, [value, multiSelect]);

  const isSelected = useCallback(
    (optionValue: string | number): boolean => {
      return selectedValues.has(optionValue);
    },
    [selectedValues],
  );

  const handleSelect = useCallback(
    (optionValue: string | number) => {
      if (multiSelect) {
        const currentValues = Array.isArray(value) ? value : [];
        const valueSet = new Set(currentValues);

        if (valueSet.has(optionValue)) {
          valueSet.delete(optionValue);
        } else {
          valueSet.add(optionValue);
        }

        onValueChange(Array.from(valueSet));
      } else {
        onValueChange(optionValue);
      }
    },
    [multiSelect, value, onValueChange],
  );

  // ==========================================================================
  // KEY EXTRACTOR
  // ==========================================================================

  const keyExtractor = useCallback(
    (item: SelectOption): string => String(item.value),
    [],
  );

  // ==========================================================================
  // ITEM SEPARATOR
  // ==========================================================================

  const ItemSeparator = useCallback(
    () => <View style={{ height: itemGap }} />,
    [itemGap],
  );

  // ==========================================================================
  // RENDER ITEM
  // ==========================================================================

  const renderItemInternal = useCallback(
    ({ item, index }: ListRenderItemInfo<SelectOption>) => {
      const itemIsSelected = isSelected(item.value);
      const itemDisabled = disabled || item.disabled || false;

      const defaultRowProps: Omit<SelectionRowProps, 'onPress'> = {
        label: item.label,
        value: item.value,
        isSelected: itemIsSelected,
        multiSelect,
        variant,
        mode,
        disabled: itemDisabled,
        hapticEnabled,
        testID: testID ? `${testID}-item-${index}` : undefined,
      };

      // If custom renderItem is provided, use it
      if (customRenderItem) {
        return customRenderItem({
          option: item,
          isSelected: itemIsSelected,
          onPress: () => handleSelect(item.value),
          disabled: itemDisabled,
          index,
          defaultRowProps,
        });
      }

      // Default rendering using SelectionRow
      return <SelectionRow {...defaultRowProps} onPress={handleSelect} />;
    },
    [
      isSelected,
      disabled,
      multiSelect,
      variant,
      mode,
      hapticEnabled,
      testID,
      customRenderItem,
      handleSelect,
    ],
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <FlatList
      data={options}
      keyExtractor={keyExtractor}
      renderItem={renderItemInternal}
      ItemSeparatorComponent={ItemSeparator}
      style={[styles.container, style]}
      contentContainerStyle={contentContainerStyle}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      accessibilityRole="list"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      // Performance optimizations
      removeClippedSubviews={false}
      initialNumToRender={options.length}
      maxToRenderPerBatch={options.length}
      windowSize={options.length + 1}
    />
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
});

export default Select;
