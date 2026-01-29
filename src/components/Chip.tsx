/**
 * Chip - Headspace Design System Chip Component
 *
 * A production-ready, reusable chip/tag component for selection states.
 * Built with Pressable for granular state control (pressed).
 *
 * Features:
 * - Multiple variants: blue, orange, outline
 * - Two sizes: sm (32px), md (40px)
 * - Light/Dark mode support
 * - Haptic feedback on toggle (when react-native-haptic-feedback is installed)
 * - Full accessibility support with selected state announcement
 * - Optional left icon support
 * - Pill shape (borderRadius: 999)
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
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
  ChipColorSchemes,
  ChipSizes,
  HSAnimation,
  type ChipSize,
  type ChipVariant,
  type HSColorMode,
} from '../theme/theme';

// =============================================================================
// HAPTIC FEEDBACK (Optional - gracefully degrades if not installed)
// =============================================================================

let HapticFeedback: {
  trigger: (type: string, options?: object) => void;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  HapticFeedback = require('react-native-haptic-feedback').default;
} catch {
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

export interface ChipProps {
  /** Chip text label */
  label: string;

  /** Whether the chip is currently selected */
  isSelected?: boolean;

  /** Chip variant - controls color scheme */
  variant?: ChipVariant;

  /** Chip size - controls height, padding, font size */
  size?: ChipSize;

  /** Color mode - light or dark theme */
  mode?: HSColorMode;

  /** Optional icon to display on the left side */
  leftIcon?: React.ReactNode;

  /** Whether the chip is disabled */
  disabled?: boolean;

  /** Whether to enable haptic feedback on press */
  hapticEnabled?: boolean;

  /** Press handler */
  onPress?: (event: GestureResponderEvent) => void;

  /** Accessibility label (defaults to label if not provided) */
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
// CHIP COMPONENT
// =============================================================================

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
  // Animation value for press scale effect
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get color scheme based on mode, variant, and selection state
  const variantScheme = ChipColorSchemes[mode][variant];
  const colorScheme = isSelected ? variantScheme.selected : variantScheme.unselected;
  const sizeConfig = ChipSizes[size];

  // Check if variant has border (outline variant)
  const hasBorder = variant === 'outline';

  // ==========================================================================
  // STYLE COMPUTATIONS (Array Style Pattern)
  // ==========================================================================

  const getBackgroundColor = useCallback(
    (pressed: boolean): string => {
      if (disabled) {
        return mode === 'dark' ? '#2A2A32' : '#F0F0F0';
      }
      return pressed ? colorScheme.backgroundPressed : colorScheme.background;
    },
    [colorScheme, disabled, mode],
  );

  const getTextColor = useCallback((): string => {
    if (disabled) {
      return mode === 'dark' ? '#5A5A62' : '#A0A0A0';
    }
    return colorScheme.text;
  }, [colorScheme, disabled, mode]);

  const getBorderStyle = useMemo((): ViewStyle | null => {
    if (!hasBorder) return null;

    const borderColor = disabled
      ? mode === 'dark'
        ? '#3D3D47'
        : '#D1D1D1'
      : (colorScheme as { borderColor?: string }).borderColor ?? 'transparent';

    return {
      borderWidth: 1.5,
      borderColor,
    };
  }, [hasBorder, colorScheme, disabled, mode]);

  // Compute container styles using Array Style Pattern
  const computeContainerStyle = useCallback(
    (state: PressableStateCallbackType): StyleProp<ViewStyle> => {
      const { pressed } = state;

      const baseStyles: ViewStyle = {
        height: sizeConfig.height,
        paddingHorizontal: sizeConfig.paddingHorizontal,
        backgroundColor: getBackgroundColor(pressed),
      };

      // Array Style Pattern: [base, variant-specific, border, custom]
      return [styles.container, baseStyles, getBorderStyle, style];
    },
    [sizeConfig, getBackgroundColor, getBorderStyle, style],
  );

  // Compute text styles using Array Style Pattern
  const computedTextStyle = useMemo((): StyleProp<TextStyle> => {
    return [
      styles.text,
      {
        fontSize: sizeConfig.fontSize,
        fontWeight: sizeConfig.fontWeight,
        color: getTextColor(),
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
  // PRESS HANDLER
  // ==========================================================================

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (disabled) return;

      // Trigger haptic feedback on successful toggle
      triggerHaptic(hapticEnabled);

      onPress?.(event);
    },
    [disabled, hapticEnabled, onPress],
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const renderContent = () => (
    <View style={[styles.contentContainer, { gap: sizeConfig.gap }]}>
      {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
      <Text style={computedTextStyle} numberOfLines={1} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={computeContainerStyle}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          selected: isSelected,
          disabled,
        }}
        testID={testID}
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
    borderRadius: 999, // Pill shape
    overflow: 'hidden',
    ...Platform.select({
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
