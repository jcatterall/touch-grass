/**
 * Slider - Reusable range slider component with smooth animations
 */

import React, { useCallback, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { triggerHaptic } from '../utils/haptics';
import { colors } from '../theme';
import {
  Colors,
  DisabledColors,
  Shadows,
  type ColorMode,
} from '../theme/theme';

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 6;

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

export interface SliderProps {
  min: number;
  max: number;
  value: number;
  onValueChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  mode?: ColorMode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export const Slider: React.FC<SliderProps> = ({
  min,
  max,
  value,
  onValueChange,
  step = 1,
  disabled = false,
  label,
  showValue = true,
  formatValue,
  mode = 'light',
  accessibilityLabel,
  accessibilityHint,
  style,
  labelStyle,
  testID,
}) => {
  const trackWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const lastValue = useRef(value);

  const colorScheme = mode === 'light' ? SliderColors.light : SliderColors.dark;
  const sliderColors = disabled ? colorScheme.disabled : colorScheme.active;

  // Convert value to position
  const valueToPosition = useCallback(
    (val: number, width: number) => {
      const clampedValue = Math.min(Math.max(val, min), max);
      const ratio = (clampedValue - min) / (max - min);
      return ratio * (width - THUMB_SIZE);
    },
    [min, max],
  );

  // Convert position to value
  const positionToValue = useCallback(
    (pos: number, width: number) => {
      const ratio = pos / (width - THUMB_SIZE);
      const rawValue = min + ratio * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.min(Math.max(steppedValue, min), max);
    },
    [min, max, step],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      trackWidth.value = width;
      translateX.value = valueToPosition(value, width);
    },
    [trackWidth, translateX, value, valueToPosition],
  );

  const updatePosition = useCallback(
    (pageX: number, containerX: number) => {
      if (disabled || trackWidth.value === 0) return;

      const localX = pageX - containerX - THUMB_SIZE / 2;
      const clampedX = Math.min(
        Math.max(localX, 0),
        trackWidth.value - THUMB_SIZE,
      );
      translateX.value = clampedX;

      const newValue = positionToValue(clampedX, trackWidth.value);
      if (newValue !== lastValue.current) {
        triggerHaptic('selection');
        lastValue.current = newValue;
        onValueChange(newValue);
      }
    },
    [disabled, trackWidth, translateX, positionToValue, onValueChange],
  );

  const handleStartShouldSetResponder = useCallback(
    () => !disabled,
    [disabled],
  );

  const handleResponderGrant = useCallback(
    (event: GestureResponderEvent) => {
      isDragging.current = true;
      startX.current = event.nativeEvent.pageX - translateX.value;
    },
    [translateX],
  );

  const handleResponderMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!isDragging.current) return;
      updatePosition(event.nativeEvent.pageX, startX.current);
    },
    [updatePosition],
  );

  const handleResponderRelease = useCallback(() => {
    isDragging.current = false;
    // Snap to stepped position with animation
    const currentValue = positionToValue(translateX.value, trackWidth.value);
    translateX.value = withSpring(
      valueToPosition(currentValue, trackWidth.value),
      SPRING_CONFIG,
    );
  }, [positionToValue, translateX, trackWidth, valueToPosition]);

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB_SIZE / 2,
  }));

  const displayValue = formatValue ? formatValue(value) : value.toString();

  const labelTextStyle: TextStyle = {
    color: disabled
      ? DisabledColors[mode].text
      : mode === 'dark'
      ? Colors.textDark
      : Colors.charcoal,
  };

  return (
    <View style={[styles.container, style]}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label && (
            <Text style={[styles.label, labelTextStyle, labelStyle]}>
              {label}
            </Text>
          )}
          {showValue && (
            <Text style={[styles.value, labelTextStyle]}>{displayValue}</Text>
          )}
        </View>
      )}
      <View
        style={styles.sliderContainer}
        onLayout={handleLayout}
        onStartShouldSetResponder={handleStartShouldSetResponder}
        onMoveShouldSetResponder={handleStartShouldSetResponder}
        onResponderGrant={handleResponderGrant}
        onResponderMove={handleResponderMove}
        onResponderRelease={handleResponderRelease}
        onResponderTerminate={handleResponderRelease}
        testID={testID}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel ?? label ?? 'Slider'}
        accessibilityHint={accessibilityHint}
        accessibilityValue={{
          min,
          max,
          now: value,
          text: displayValue,
        }}
      >
        <View style={[styles.track, { backgroundColor: sliderColors.track }]}>
          <Animated.View
            style={[
              styles.fill,
              { backgroundColor: sliderColors.fill },
              animatedFillStyle,
            ]}
          />
        </View>
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: sliderColors.thumb,
              borderWidth: 3,
              borderColor: sliderColors.thumbBorder,
            },
            animatedThumbStyle,
          ]}
        />
      </View>
    </View>
  );
};

const SliderColors = {
  light: {
    active: {
      track: '#EAEAEA',
      fill: colors.primary.blue,
      thumb: colors.neutral.white,
      thumbBorder: colors.primary.blue,
    },
    disabled: {
      track: '#F0F0F0',
      fill: '#D1D1D1',
      thumb: '#F5F5F5',
      thumbBorder: '#D1D1D1',
    },
  },
  dark: {
    active: {
      track: colors.neutral.white,
      fill: colors.primary.blue,
      thumb: colors.neutral.white,
      thumbBorder: colors.primary.blue,
    },
    disabled: {
      track: '#3D3D47',
      fill: '#5A5A62',
      thumb: '#5A5A62',
      thumbBorder: '#5A5A62',
    },
  },
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  sliderContainer: {
    height: THUMB_SIZE + 8,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'visible',
  },
  fill: {
    position: 'absolute',
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    ...Shadows.md,
    ...Platform.select({
      android: { elevation: Shadows.md.elevation },
    }),
  },
});

export default Slider;
