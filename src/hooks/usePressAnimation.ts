/**
 * Shared hook for press scale animation
 */

import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { Animation } from '../theme/theme';

export const usePressAnimation = () => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: Animation.pressedScale,
      duration: Animation.duration.press,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: Animation.duration.release,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return { scaleAnim, handlePressIn, handlePressOut };
};
