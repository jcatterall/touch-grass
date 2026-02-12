/**
 * Toggle - Reusable toggle switch component with smooth animations
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

import { triggerHaptic } from '../utils/haptics';
import {
  Colors,
  DisabledColors,
  ToggleSizes,
  ToggleColorSchemes,
  ToggleShadow,
} from '../theme/theme';

const ANIMATION_CONFIG = {
  duration: 250,
  easing: Easing.bezier(0.4, 0.0, 0.2, 1),
};

export interface ToggleProps {
  isOn: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  isOn,
  onToggle,
  disabled = false,
  label,
  accessibilityLabel,
  accessibilityHint,
  style,
  labelStyle,
  testID,
}) => {
  const progress = useSharedValue(isOn ? 1 : 0);
  const thumbTranslation =
    ToggleSizes.track.width - ToggleSizes.thumb.size - ToggleSizes.thumb.margin * 2;

  useEffect(() => {
    progress.value = withTiming(isOn ? 1 : 0, ANIMATION_CONFIG);
  }, [isOn, progress]);

  const animatedTrackStyle = useAnimatedStyle(() => {
    const trackOffColor = disabled ? ToggleColorSchemes.disabled.track : ToggleColorSchemes.off.track;
    const trackOnColor = disabled ? ToggleColorSchemes.disabled.track : ToggleColorSchemes.on.track;
    return {
      backgroundColor: interpolateColor(progress.value, [0, 1], [trackOffColor, trackOnColor]),
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * thumbTranslation }],
  }));

  const handlePress = useCallback(() => {
    if (disabled) return;
    triggerHaptic('selection');
    onToggle(!isOn);
  }, [disabled, isOn, onToggle]);

  const thumbBackgroundColor = disabled ? ToggleColorSchemes.disabled.thumb : ToggleColorSchemes.on.thumb;

  const labelTextStyle: TextStyle = {
    color: disabled
      ? DisabledColors.text
      : Colors.textDark,
  };

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
          style={[styles.thumb, { backgroundColor: thumbBackgroundColor }, animatedThumbStyle]}
        />
      </Animated.View>
    </Pressable>
  );

  if (label) {
    return (
      <View style={[styles.row, style]}>
        <Text style={[styles.label, labelTextStyle, labelStyle]} numberOfLines={1}>
          {label}
        </Text>
        {toggleSwitch}
      </View>
    );
  }

  return <View style={style}>{toggleSwitch}</View>;
};

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
      android: { elevation: ToggleShadow.elevation },
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
