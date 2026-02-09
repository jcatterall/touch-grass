import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Typography } from '../../../components';
import {
  usageStyles,
  createBigNumberStyle,
  bigNumberColors,
} from './Usage.styles';

const bigNumberGreen = createBigNumberStyle(bigNumberColors.green);

const ANIMATION_CONFIG = {
  duration: 400,
  easing: Easing.bezier(0.4, 0.0, 0.2, 1),
};

export const UsageFirstWeek = () => {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(200, withTiming(1, ANIMATION_CONFIG));
    opacity.value = withDelay(200, withTiming(1, ANIMATION_CONFIG));
  }, [scale, opacity]);

  const animatedBigNumberStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={usageStyles.slidePage}
    >
      <View style={usageStyles.slideHeader}>
        <Typography mode="dark" variant="heading" center>
          Change starts faster than you think.
        </Typography>
        <Typography mode="dark" variant="subtitle" color="secondary" center>
          TouchGrass can help cut down the time on your phone by up to 32% in
          the first week of use.
        </Typography>
      </View>
      <View style={usageStyles.centerContent}>
        <Animated.Text style={[bigNumberGreen, animatedBigNumberStyle]}>
          32%
        </Animated.Text>
      </View>
    </Animated.View>
  );
};
