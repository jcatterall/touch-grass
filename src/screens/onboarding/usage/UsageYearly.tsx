import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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

export const UsageYearly = ({ average, yearsIn30 }: UsageYearlyProps) => (
  <Animated.View
    entering={FadeIn.duration(300)}
    exiting={FadeOut.duration(200)}
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
      <Text style={bigNumberPurple}>{yearsIn30}</Text>
      <Typography variant="heading">YEARS</Typography>
      <Typography variant="subtitle" color="secondary">
        spent on your phone
      </Typography>
    </View>
  </Animated.View>
);
