/**
 * Toggle - Headspace Design System Toggle Switch Component
 *
 * A production-ready, reusable toggle switch component following Headspace design patterns.
 * Built with React Native Reanimated for smooth 60fps animations on the UI thread.
 *
 * Features:
 * - Smooth animated track color and thumb translation
 * - Light/Dark mode support
 * - Haptic feedback on state change
 * - Full accessibility support (accessibilityRole="switch")
 * - Optional inline label for list row layouts
 * - Disabled state styling
 */

import React, { useCallback, useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import {
  HSColors,
  ToggleSizes,
  ToggleColorSchemes,
  ToggleShadow,
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

const triggerHaptic = (): void => {
  if (!HapticFeedback) return;

  try {
    HapticFeedback.trigger('selection', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  } catch {
    // Silently fail if haptics unavailable
  }
};

// =============================================================================
// ANIMATION CONFIGURATION
// =============================================================================

const ANIMATION_CONFIG = {
  duration: 250,
  easing: Easing.bezier(0.4, 0.0, 0.2, 1),
};

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface ToggleProps {
  /** Current toggle state */
  isOn: boolean;

  /** Callback when toggle state changes */
  onToggle: (value: boolean) => void;

  /** Whether the toggle is disabled */
  disabled?: boolean;

  /** Optional label to display alongside the toggle (list row style) */
  label?: string;

  /** Color mode - light or dark theme */
  mode?: HSColorMode;

  /** Accessibility label (uses label prop if not provided) */
  accessibilityLabel?: string;

  /** Accessibility hint for screen readers */
  accessibilityHint?: string;

  /** Custom container style (for the entire row including label) */
  style?: StyleProp<ViewStyle>;

  /** Custom label text style */
  labelStyle?: StyleProp<TextStyle>;

  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// TOGGLE COMPONENT
// =============================================================================

export const Toggle: React.FC<ToggleProps> = ({
  isOn,
  onToggle,
  disabled = false,
  label,
  mode = 'light',
  accessibilityLabel,
  accessibilityHint,
  style,
  labelStyle,
  testID,
}) => {
  // Shared value for animation progress (0 = off, 1 = on)
  const progress = useSharedValue(isOn ? 1 : 0);

  // Get color scheme based on mode
  const colorScheme = ToggleColorSchemes[mode];

  // Calculate thumb translation distance
  const thumbTranslation =
    ToggleSizes.track.width - ToggleSizes.thumb.size - ToggleSizes.thumb.margin * 2;

  // ==========================================================================
  // SYNC ANIMATION WITH PROP CHANGES
  // ==========================================================================

  useEffect(() => {
    progress.value = withTiming(isOn ? 1 : 0, ANIMATION_CONFIG);
  }, [isOn, progress]);

  // ==========================================================================
  // ANIMATED STYLES
  // ==========================================================================

  const animatedTrackStyle = useAnimatedStyle(() => {
    const trackOffColor = disabled ? colorScheme.disabled.track : colorScheme.off.track;
    const trackOnColor = disabled ? colorScheme.disabled.track : colorScheme.on.track;

    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [trackOffColor, trackOnColor]
      ),
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: progress.value * thumbTranslation,
        },
      ],
    };
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handlePress = useCallback(() => {
    if (disabled) return;

    // Trigger haptic feedback
    triggerHaptic();

    // Toggle the state
    onToggle(!isOn);
  }, [disabled, isOn, onToggle]);

  // ==========================================================================
  // COMPUTED STYLES
  // ==========================================================================

  const thumbBackgroundColor = disabled
    ? colorScheme.disabled.thumb
    : colorScheme.on.thumb;

  const labelTextStyle: TextStyle = {
    color: disabled
      ? mode === 'dark'
        ? '#6B6B73'
        : HSColors.disabled
      : mode === 'dark'
        ? '#E0E0E0'
        : HSColors.charcoal,
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const toggleSwitch = (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: isOn, disabled }}
      accessibilityLabel={accessibilityLabel ?? label ?? 'Toggle'}
      accessibilityHint={accessibilityHint}
      testID={testID}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[styles.track, animatedTrackStyle]}>
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: thumbBackgroundColor },
            animatedThumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );

  // If label is provided, render in a row layout
  if (label) {
    return (
      <View style={[styles.row, style]}>
        <Text
          style={[styles.label, labelTextStyle, labelStyle]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {toggleSwitch}
      </View>
    );
  }

  // Standalone toggle without label
  return <View style={style}>{toggleSwitch}</View>;
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  track: {
    width: ToggleSizes.track.width,
    height: ToggleSizes.track.height,
    borderRadius: ToggleSizes.track.borderRadius,
    justifyContent: 'center',
    paddingHorizontal: ToggleSizes.thumb.margin,
  },
  thumb: {
    width: ToggleSizes.thumb.size,
    height: ToggleSizes.thumb.size,
    borderRadius: ToggleSizes.thumb.size / 2,
    ...ToggleShadow,
    ...Platform.select({
      android: {
        elevation: ToggleShadow.elevation,
      },
    }),
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 16,
  },
});

export default Toggle;
