/**
 * Button - Headspace Design System Button Component
 *
 * A production-ready, reusable button component following Headspace design patterns.
 * Built with Pressable for granular state control (hover, pressed, focus).
 *
 * Features:
 * - Multiple variants: primary, secondary, tertiary, danger
 * - Multiple sizes: sm, md, lg, xl
 * - Light/Dark mode support
 * - Haptic feedback (when react-native-haptic-feedback is installed)
 * - Full accessibility support
 * - Loading state with ActivityIndicator
 * - Icon support (left position)
 * - Shape variants: pill, rounded
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
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

import {
  HSAnimation,
  ButtonShapes,
  ButtonSizes,
  ButtonTypography,
  HSColorSchemes,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
  type HSColorMode,
} from '../theme/theme';

// =============================================================================
// HAPTIC FEEDBACK (Optional - gracefully degrades if not installed)
// =============================================================================

let HapticFeedback: {
  trigger: (type: string, options?: object) => void;
} | null = null;

try {
  // Attempt to import react-native-haptic-feedback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  HapticFeedback = require('react-native-haptic-feedback').default;
} catch {
  // Package not installed - haptics will be disabled
  HapticFeedback = null;
}

const triggerHaptic = (enabled: boolean = true): void => {
  if (!enabled || !HapticFeedback) return;

  try {
    HapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  } catch {
    // Silently fail if haptics unavailable
  }
};

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface ButtonProps {
  /** Button text content */
  children: string;

  /** Button variant - controls color scheme */
  variant?: ButtonVariant;

  /** Button size - controls height, padding, font size */
  size?: ButtonSize;

  /** Color mode - light or dark theme */
  mode?: HSColorMode;

  /** Button shape - pill (fully rounded) or rounded (12px radius) */
  shape?: ButtonShape;

  /** Optional icon to display on the left side */
  iconLeft?: React.ReactNode;

  /** Whether the button is in a loading state */
  isLoading?: boolean;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Whether to enable haptic feedback on press */
  hapticEnabled?: boolean;

  /** Press handler */
  onPress?: (event: GestureResponderEvent) => void;

  /** Long press handler */
  onLongPress?: (event: GestureResponderEvent) => void;

  /** Accessibility label (defaults to children if not provided) */
  accessibilityLabel?: string;

  /** Accessibility hint for screen readers */
  accessibilityHint?: string;

  /** Custom container style */
  style?: StyleProp<ViewStyle>;

  /** Custom text style */
  textStyle?: StyleProp<TextStyle>;

  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// Button COMPONENT
// =============================================================================

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
  // Animation value for press scale effect
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get color scheme based on mode and variant
  const colorScheme = HSColorSchemes[mode][variant];
  const sizeConfig = ButtonSizes[size];
  const borderRadius = ButtonShapes[shape];

  // Determine if button is effectively disabled
  const isDisabled = disabled || isLoading;

  // ==========================================================================
  // STYLE COMPUTATIONS (Array Style Pattern)
  // ==========================================================================

  const getBackgroundColor = useCallback(
    (pressed: boolean): string => {
      if (isDisabled) {
        return colorScheme.backgroundDisabled;
      }
      return pressed ? colorScheme.backgroundPressed : colorScheme.background;
    },
    [colorScheme, isDisabled],
  );

  const getBorderStyle = useMemo((): ViewStyle | null => {
    if (variant !== 'tertiary') return null;

    const tertiaryScheme = HSColorSchemes[mode].tertiary;
    return {
      borderWidth: sizeConfig.borderWidth,
      borderColor: isDisabled
        ? tertiaryScheme.borderColorDisabled
        : tertiaryScheme.borderColor,
    };
  }, [variant, mode, sizeConfig.borderWidth, isDisabled]);

  const getTextColor = useCallback((): string => {
    return isDisabled ? colorScheme.textDisabled : colorScheme.text;
  }, [colorScheme, isDisabled]);

  // Compute container styles using Array Style Pattern
  const computeContainerStyle = useCallback(
    (state: PressableStateCallbackType): StyleProp<ViewStyle> => {
      const { pressed } = state;

      const baseStyles: ViewStyle = {
        height: sizeConfig.height,
        paddingHorizontal: sizeConfig.paddingHorizontal,
        borderRadius,
        backgroundColor: getBackgroundColor(pressed),
      };

      // Array Style Pattern: combine base + variant-specific + custom styles
      return [styles.container, baseStyles, getBorderStyle, style];
    },
    [sizeConfig, borderRadius, getBackgroundColor, getBorderStyle, style],
  );

  // Compute text styles using Array Style Pattern
  const computedTextStyle = useMemo((): StyleProp<TextStyle> => {
    return [
      styles.text,
      {
        fontSize: sizeConfig.fontSize,
        fontWeight: sizeConfig.fontWeight,
        color: getTextColor(),
        letterSpacing: ButtonTypography.letterSpacing,
      },
      textStyle,
    ];
  }, [sizeConfig, getTextColor, textStyle]);

  // ==========================================================================
  // ANIMATION HANDLERS
  // ==========================================================================

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: HSAnimation.pressedScale,
      duration: HSAnimation.duration.press,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: HSAnimation.duration.release,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  // ==========================================================================
  // PRESS HANDLERS
  // ==========================================================================

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (isDisabled) return;

      // Trigger haptic feedback
      triggerHaptic(hapticEnabled);

      // Call provided onPress handler
      onPress?.(event);
    },
    [isDisabled, hapticEnabled, onPress],
  );

  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (isDisabled) return;

      // Trigger stronger haptic for long press
      if (hapticEnabled && HapticFeedback) {
        try {
          HapticFeedback.trigger('impactMedium', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        } catch {
          // Silently fail
        }
      }

      onLongPress?.(event);
    },
    [isDisabled, hapticEnabled, onLongPress],
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const renderContent = () => {
    if (isLoading) {
      return (
        <ActivityIndicator
          size="small"
          color={getTextColor()}
          testID={testID ? `${testID}-loading` : undefined}
        />
      );
    }

    return (
      <View style={styles.contentContainer}>
        {iconLeft && <View style={styles.iconContainer}>{iconLeft}</View>}
        <Text
          style={computedTextStyle}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {children}
        </Text>
      </View>
    );
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={computeContainerStyle}
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? children}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: isDisabled,
          busy: isLoading,
        }}
        testID={testID}
        // Android ripple effect (disabled for consistent cross-platform feel)
        android_ripple={null}
      >
        {renderContent}
      </Pressable>
    </Animated.View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        // iOS-specific shadows for subtle depth
      },
      android: {
        elevation: 0,
      },
    }),
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    textAlign: 'center',
    includeFontPadding: false, // Android: removes extra padding
    textAlignVertical: 'center',
  },
});

export default Button;
