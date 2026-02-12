/**
 * SelectionRow - Reusable row component for selection lists (radio/checkbox style)
 */

import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { usePressAnimation } from '../hooks/usePressAnimation';
import { triggerHaptic } from '../utils/haptics';
import {
  Borders,
  DisabledColors,
  SelectColorSchemes,
  SelectSizes,
  type SelectVariant,
} from '../theme/theme';

interface CheckIconProps {
  size: number;
  color: string;
}

const CheckIcon: React.FC<CheckIconProps> = ({ size, color }) => (
  <View
    style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <View
      style={{
        width: size * 0.6,
        height: size * 0.35,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: '-45deg' }, { translateY: -size * 0.05 }],
      }}
    />
  </View>
);

export interface SelectionRowProps {
  label: string;
  value: string | number;
  isSelected: boolean;
  multiSelect?: boolean;
  variant?: SelectVariant;
  disabled?: boolean;
  hapticEnabled?: boolean;
  onPress?: (value: string | number) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export const SelectionRow: React.FC<SelectionRowProps> = ({
  label,
  value,
  isSelected,
  multiSelect = false,
  variant = 'blue',
  disabled = false,
  hapticEnabled = true,
  onPress,
  accessibilityLabel,
  style,
  textStyle,
  testID,
}) => {
  const { scaleAnim, handlePressIn, handlePressOut } = usePressAnimation();

  const variantScheme = SelectColorSchemes[variant];
  const colorScheme = isSelected
    ? variantScheme.selected
    : variantScheme.unselected;

  const getBackgroundColor = (pressed: boolean): string => {
    if (disabled) return DisabledColors.background;
    return pressed ? colorScheme.backgroundPressed : colorScheme.background;
  };

  const textColor = disabled ? DisabledColors.text : colorScheme.text;
  const borderColor = disabled
    ? 'transparent'
    : isSelected
    ? colorScheme.borderColor
    : 'transparent';

  const getContainerStyle = (
    state: PressableStateCallbackType,
  ): StyleProp<ViewStyle> => [
    styles.container,
    {
      height: SelectSizes.rowHeight,
      paddingHorizontal: SelectSizes.paddingHorizontal,
      borderRadius: SelectSizes.borderRadius,
      backgroundColor: getBackgroundColor(state.pressed),
      borderWidth: isSelected ? Borders.width.medium : 0,
      borderColor,
    },
    style,
  ];

  const computedTextStyle: StyleProp<TextStyle> = [
    styles.label,
    {
      fontSize: SelectSizes.fontSize,
      fontWeight: SelectSizes.fontWeight,
      color: textColor,
    },
    textStyle,
  ];

  const getIndicatorStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      width: SelectSizes.indicatorSize,
      height: SelectSizes.indicatorSize,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: multiSelect
        ? Borders.radius.xs
        : SelectSizes.indicatorSize / 2,
    };

    if (disabled) {
      return {
        ...baseStyle,
        backgroundColor: DisabledColors.indicator,
        borderWidth: multiSelect && !isSelected ? Borders.width.medium : 0,
        borderColor: DisabledColors.border,
      };
    }

    if (isSelected) {
      return { ...baseStyle, backgroundColor: colorScheme.indicator };
    }

    return {
      ...baseStyle,
      backgroundColor: 'transparent',
      borderWidth: Borders.width.medium,
      borderColor: variantScheme.unselected.indicator,
    };
  };

  const handlePress = () => {
    if (disabled) return;
    if (hapticEnabled) triggerHaptic('selection');
    onPress?.(value);
  };

  const renderIndicator = () => {
    // Do not render any indicator for single-selection (radio) style
    if (!multiSelect) return null;

    const indicatorStyle = getIndicatorStyle();

    if (isSelected) {
      return (
        <View style={indicatorStyle}>
          <CheckIcon
            size={SelectSizes.checkIconSize}
            color={colorScheme.checkIcon}
          />
        </View>
      );
    }

    return <View style={indicatorStyle} />;
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={getContainerStyle}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessible
        accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{
          selected: isSelected,
          checked: multiSelect ? isSelected : undefined,
          disabled,
        }}
        testID={testID}
        android_ripple={null}
      >
        <View style={styles.content}>
          <Text
            style={computedTextStyle}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
          {renderIndicator()}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default SelectionRow;
