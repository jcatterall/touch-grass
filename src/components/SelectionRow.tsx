/**
 * SelectionRow - Headspace Design System Selection Row Atom
 *
 * A reusable row component for selection lists (radio/checkbox style).
 * Built with Pressable for granular state control.
 *
 * Features:
 * - Two variants: blue, orange (Headspace brand colors)
 * - Light/Dark mode support
 * - Haptic feedback on selection
 * - Full accessibility support (radio/checkbox roles)
 * - 56px height with 12px border radius (Headspace spec)
 * - Radio (single) or Checkbox (multi) indicator styles
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
  HSAnimation,
  SelectColorSchemes,
  SelectSizes,
  type HSColorMode,
  type SelectVariant,
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

const triggerSelectionHaptic = (enabled: boolean = true): void => {
  if (!enabled || !HapticFeedback) return;

  try {
    // Use 'selection' haptic type for selection feedback
    HapticFeedback.trigger('selection', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  } catch {
    // Silently fail if haptics unavailable
  }
};

// =============================================================================
// CHECKMARK ICON COMPONENT
// =============================================================================

interface CheckIconProps {
  size: number;
  color: string;
}

const CheckIcon: React.FC<CheckIconProps> = ({ size, color }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
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

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface SelectionRowProps {
  /** Row label text */
  label: string;

  /** Unique value for this row */
  value: string | number;

  /** Whether the row is currently selected */
  isSelected: boolean;

  /** Whether this is a multi-select (checkbox) or single-select (radio) */
  multiSelect?: boolean;

  /** Color variant */
  variant?: SelectVariant;

  /** Color mode - light or dark theme */
  mode?: HSColorMode;

  /** Whether the row is disabled */
  disabled?: boolean;

  /** Whether to enable haptic feedback on press */
  hapticEnabled?: boolean;

  /** Press handler - receives the value */
  onPress?: (value: string | number) => void;

  /** Accessibility label (defaults to label if not provided) */
  accessibilityLabel?: string;

  /** Custom container style */
  style?: StyleProp<ViewStyle>;

  /** Custom text style */
  textStyle?: StyleProp<TextStyle>;

  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// SELECTION ROW COMPONENT
// =============================================================================

export const SelectionRow: React.FC<SelectionRowProps> = ({
  label,
  value,
  isSelected,
  multiSelect = false,
  variant = 'blue',
  mode = 'light',
  disabled = false,
  hapticEnabled = true,
  onPress,
  accessibilityLabel,
  style,
  textStyle,
  testID,
}) => {
  // Animation value for press scale effect
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get color scheme based on mode, variant, and selection state
  const variantScheme = SelectColorSchemes[mode][variant];
  const colorScheme = isSelected ? variantScheme.selected : variantScheme.unselected;

  // ==========================================================================
  // STYLE COMPUTATIONS
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

  const getBorderColor = useCallback((): string => {
    if (disabled) {
      return 'transparent';
    }
    return isSelected ? colorScheme.borderColor : 'transparent';
  }, [colorScheme, isSelected, disabled]);

  // Compute container styles
  const computeContainerStyle = useCallback(
    (state: PressableStateCallbackType): StyleProp<ViewStyle> => {
      const { pressed } = state;

      const baseStyles: ViewStyle = {
        height: SelectSizes.rowHeight,
        paddingHorizontal: SelectSizes.paddingHorizontal,
        borderRadius: SelectSizes.borderRadius,
        backgroundColor: getBackgroundColor(pressed),
        borderWidth: isSelected ? 2 : 0,
        borderColor: getBorderColor(),
      };

      return [styles.container, baseStyles, style];
    },
    [getBackgroundColor, getBorderColor, isSelected, style],
  );

  // Compute text styles
  const computedTextStyle = useMemo((): StyleProp<TextStyle> => {
    return [
      styles.label,
      {
        fontSize: SelectSizes.fontSize,
        fontWeight: SelectSizes.fontWeight,
        color: getTextColor(),
      },
      textStyle,
    ];
  }, [getTextColor, textStyle]);

  // ==========================================================================
  // INDICATOR STYLES
  // ==========================================================================

  const indicatorStyle = useMemo((): ViewStyle => {
    const baseStyle: ViewStyle = {
      width: SelectSizes.indicatorSize,
      height: SelectSizes.indicatorSize,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: multiSelect ? 4 : SelectSizes.indicatorSize / 2,
    };

    if (disabled) {
      return {
        ...baseStyle,
        backgroundColor: mode === 'dark' ? '#3D3D47' : '#E0E0E0',
        borderWidth: multiSelect && !isSelected ? 2 : 0,
        borderColor: mode === 'dark' ? '#5A5A62' : '#D1D1D1',
      };
    }

    if (isSelected) {
      return {
        ...baseStyle,
        backgroundColor: colorScheme.indicator,
      };
    }

    return {
      ...baseStyle,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: variantScheme.unselected.indicator,
    };
  }, [multiSelect, isSelected, colorScheme, variantScheme, disabled, mode]);

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

      // Trigger 'selection' haptic feedback
      triggerSelectionHaptic(hapticEnabled);

      onPress?.(value);
    },
    [disabled, hapticEnabled, onPress, value],
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const renderIndicator = () => {
    if (isSelected) {
      if (multiSelect) {
        // Checkbox with checkmark
        return (
          <View style={indicatorStyle}>
            <CheckIcon size={SelectSizes.checkIconSize} color={colorScheme.checkIcon} />
          </View>
        );
      } else {
        // Radio with inner dot
        return (
          <View style={indicatorStyle}>
            <View
              style={{
                width: SelectSizes.indicatorSize * 0.4,
                height: SelectSizes.indicatorSize * 0.4,
                borderRadius: SelectSizes.indicatorSize * 0.2,
                backgroundColor: colorScheme.checkIcon,
              }}
            />
          </View>
        );
      }
    }

    // Unselected indicator (empty circle or square)
    return <View style={indicatorStyle} />;
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={computeContainerStyle}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessible={true}
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
          <Text style={computedTextStyle} numberOfLines={1} allowFontScaling={false}>
            {label}
          </Text>
          {renderIndicator()}
        </View>
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
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 0,
      },
    }),
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
