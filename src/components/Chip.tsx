/**
 * Chip - Reusable chip/tag component for selection states
 */

import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { usePressAnimation } from '../hooks/usePressAnimation';
import { triggerHaptic } from '../utils/haptics';
import {
  ChipColorSchemes,
  ChipSizes,
  Borders,
  DisabledColors,
  type ChipSize,
  type ChipVariant,
  type ColorMode,
} from '../theme/theme';

export interface ChipProps {
  label: string;
  isSelected?: boolean;
  variant?: ChipVariant;
  size?: ChipSize;
  mode?: ColorMode;
  leftIcon?: React.ReactNode;
  disabled?: boolean;
  hapticEnabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  isSelected = false,
  variant = 'blue',
  size = 'sm',
  mode = 'light',
  leftIcon,
  disabled = false,
  hapticEnabled = true,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
  testID,
}) => {
  const { scaleAnim, handlePressIn, handlePressOut } = usePressAnimation();

  const variantScheme = ChipColorSchemes[mode][variant];
  const colorScheme = isSelected ? variantScheme.selected : variantScheme.unselected;
  const sizeConfig = ChipSizes[size];
  const hasBorder = variant === 'outline';

  const getBackgroundColor = (pressed: boolean): string => {
    if (disabled) return DisabledColors[mode].background;
    return pressed ? colorScheme.backgroundPressed : colorScheme.background;
  };

  const textColor = disabled ? DisabledColors[mode].text : colorScheme.text;

  const getBorderStyle = (): ViewStyle | null => {
    if (!hasBorder) return null;
    const borderColor = disabled
      ? DisabledColors[mode].border
      : (colorScheme as { borderColor?: string }).borderColor ?? 'transparent';
    return { borderWidth: Borders.width.normal, borderColor };
  };

  const getContainerStyle = (state: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.container,
    {
      height: sizeConfig.height,
      paddingHorizontal: sizeConfig.paddingHorizontal,
      backgroundColor: getBackgroundColor(state.pressed),
    },
    getBorderStyle(),
    style,
  ];

  const computedTextStyle: StyleProp<TextStyle> = [
    styles.text,
    {
      fontSize: sizeConfig.fontSize,
      fontWeight: sizeConfig.fontWeight,
      color: textColor,
    },
    textStyle,
  ];

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled) return;
    if (hapticEnabled) triggerHaptic('impactLight');
    onPress?.(event);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={getContainerStyle}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected: isSelected, disabled }}
        testID={testID}
        android_ripple={null}
      >
        <View style={[styles.contentContainer, { gap: sizeConfig.gap }]}>
          {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
          <Text style={computedTextStyle} numberOfLines={1} allowFontScaling={false}>
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Borders.radius.pill,
    overflow: 'hidden',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default Chip;
