import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
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

interface UsageYearlyProps {
  average: {
    hours: number;
    minutes: number;
  };
  yearsIn30: string;
}

const bigNumberPurple = createBigNumberStyle(bigNumberColors.purple, 120);

const ANIMATION_CONFIG = {
  duration: 400,
  easing: Easing.bezier(0.4, 0.0, 0.2, 1),
};

export const UsageYearly = ({ average, yearsIn30 }: UsageYearlyProps) => {
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
        <Typography variant="title">
          {average.hours}h {average.minutes}m a day.
        </Typography>
        <Typography variant="heading" center>
          In 30 years that adds up to
        </Typography>
      </View>
      <View style={usageStyles.centerContent}>
        <Animated.Text style={[bigNumberPurple, animatedBigNumberStyle]}>
          {yearsIn30}
        </Animated.Text>
        <Animated.View entering={FadeInUp.delay(400).duration(300)}>
          <Typography variant="heading">YEARS</Typography>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(500).duration(300)}>
          <Typography variant="subtitle" color="secondary">
            spent on your phone
          </Typography>
        </Animated.View>
      </View>
    </Animated.View>
  );
};
