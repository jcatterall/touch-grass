import { useEffect } from 'react';
import { TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
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

export const UsageYearly = ({ average, yearsIn30 }: UsageYearlyProps) => {
  const target = parseFloat(yearsIn30);
  const counter = useSharedValue(0);

  useEffect(() => {
    counter.value = withDelay(
      200,
      withTiming(target, { duration: 3000, easing: Easing.out(Easing.quad) }),
    );
  }, [target, counter]);

  const animatedProps = useAnimatedProps(() => ({
    text: (Math.round(counter.value * 10) / 10).toFixed(1),
    defaultValue: '',
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
        <AnimatedTextInput
          style={bigNumberTerracotta}
          animatedProps={animatedProps}
          editable={false}
          pointerEvents="none"
        />
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
