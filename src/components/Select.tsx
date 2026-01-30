/**
 * Select - Reusable selection list component with single/multi-select modes
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

import { type ColorMode, type SelectVariant } from '../theme/theme';
import { SelectionRow, type SelectionRowProps } from './SelectionRow';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface CustomRenderItemProps {
  option: SelectOption;
  isSelected: boolean;
  onPress: () => void;
  disabled: boolean;
  index: number;
  defaultRowProps: Omit<SelectionRowProps, 'onPress'>;
}

export interface SelectProps {
  options: SelectOption[];
  value: (string | number) | (string | number)[];
  multiSelect?: boolean;
  onValueChange: (value: (string | number) | (string | number)[]) => void;
  variant?: SelectVariant;
  mode?: ColorMode;
  hapticEnabled?: boolean;
  itemGap?: number;
  renderItem?: (props: CustomRenderItemProps) => React.ReactElement;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

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
  const selectedValues = useMemo((): Set<string | number> => {
    if (multiSelect) {
      return new Set(Array.isArray(value) ? value : [value]);
    }
    return new Set([value as string | number]);
  }, [value, multiSelect]);

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

  const renderItemInternal = useCallback(
    ({ item, index }: ListRenderItemInfo<SelectOption>) => {
      const itemIsSelected = selectedValues.has(item.value);
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

      return <SelectionRow {...defaultRowProps} onPress={handleSelect} />;
    },
    [selectedValues, disabled, multiSelect, variant, mode, hapticEnabled, testID, customRenderItem, handleSelect],
  );

  const ItemSeparator = useCallback(() => <View style={{ height: itemGap }} />, [itemGap]);

  return (
    <FlatList
      data={options}
      keyExtractor={(item) => String(item.value)}
      renderItem={renderItemInternal}
      ItemSeparatorComponent={ItemSeparator}
      style={[styles.container, style]}
      contentContainerStyle={contentContainerStyle}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      accessibilityRole="list"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      removeClippedSubviews={false}
      initialNumToRender={options.length}
      maxToRenderPerBatch={options.length}
      windowSize={options.length + 1}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
});

export default Select;
