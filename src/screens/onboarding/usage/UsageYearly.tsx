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
import { colors } from '../../../theme';
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

const bigNumberTerracotta = createBigNumberStyle(
  bigNumberColors.terracotta,
  120,
);

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
        <Typography variant="title" style={{ color: colors.terracotta }}>
          {average.hours}h {average.minutes}m a day
        </Typography>
        <Typography variant="heading" center>
          In <Typography variant="heading" style={{ color: colors.terracotta }}>30 years</Typography> that adds up to
        </Typography>
      </View>
      <View style={usageStyles.centerContent}>
        <Animated.Text style={[bigNumberTerracotta, animatedBigNumberStyle]}>
          {yearsIn30}
        </Animated.Text>
        <Animated.View entering={FadeInUp.delay(400).duration(300)}>
          <Typography variant="heading">YEARS</Typography>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(500).duration(300)}>
          <Typography variant="subtitle">spent on your phone</Typography>
        </Animated.View>
      </View>
    </Animated.View>
  );
};
