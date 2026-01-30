/**
 * Button - Reusable button component with multiple variants, sizes, and states
 */

import React from 'react';
import {
  ActivityIndicator,
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
  Spacing,
  ButtonShapes,
  ButtonSizes,
  ButtonTypography,
  ColorSchemes,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
  type ColorMode,
} from '../theme/theme';

export interface ButtonProps {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  mode?: ColorMode;
  shape?: ButtonShape;
  iconLeft?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  hapticEnabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  mode = 'light',
  shape = 'pill',
  iconLeft,
  isLoading = false,
  disabled = false,
  hapticEnabled = true,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
  testID,
}) => {
  const { scaleAnim, handlePressIn, handlePressOut } = usePressAnimation();

  const colorScheme = ColorSchemes[mode][variant];
  const sizeConfig = ButtonSizes[size];
  const borderRadius = ButtonShapes[shape];
  const isDisabled = disabled || isLoading;

  const getBackgroundColor = (pressed: boolean): string => {
    if (isDisabled) return colorScheme.backgroundDisabled;
    return pressed ? colorScheme.backgroundPressed : colorScheme.background;
  };

  const textColor = isDisabled ? colorScheme.textDisabled : colorScheme.text;

  const getBorderStyle = (): ViewStyle | null => {
    if (variant !== 'tertiary') return null;
    const tertiaryScheme = ColorSchemes[mode].tertiary;
    return {
      borderWidth: sizeConfig.borderWidth,
      borderColor: isDisabled
        ? tertiaryScheme.borderColorDisabled
        : tertiaryScheme.borderColor,
    };
  };

  const getContainerStyle = (state: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.container,
    {
      height: sizeConfig.height,
      paddingHorizontal: sizeConfig.paddingHorizontal,
      borderRadius,
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
      letterSpacing: ButtonTypography.letterSpacing,
    },
    textStyle,
  ];

  const handlePress = (event: GestureResponderEvent) => {
    if (isDisabled) return;
    if (hapticEnabled) triggerHaptic('impactLight');
    onPress?.(event);
  };

  const handleLongPress = (event: GestureResponderEvent) => {
    if (isDisabled) return;
    if (hapticEnabled) triggerHaptic('impactMedium');
    onLongPress?.(event);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <ActivityIndicator
          size="small"
          color={textColor}
          testID={testID ? `${testID}-loading` : undefined}
        />
      );
    }

    return (
      <View style={styles.contentContainer}>
        {iconLeft && <View style={styles.iconContainer}>{iconLeft}</View>}
        <Text style={computedTextStyle} numberOfLines={1} allowFontScaling={false}>
          {children}
        </Text>
      </View>
    );
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={getContainerStyle}
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? children}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: isLoading }}
        testID={testID}
        android_ripple={null}
      >
        {renderContent()}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
  text: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default Button;
