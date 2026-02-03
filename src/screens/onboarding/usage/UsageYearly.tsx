import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { typography } from '../../../theme';
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
      <Text style={typography.styles.light.heading}>
        {average.hours}h {average.minutes}m a day.
      </Text>
      <Text
        style={[
          typography.styles.light.largeHeading,
          usageStyles.textCentered,
        ]}
      >
        In 30 years that adds up to
      </Text>
    </View>
    <View style={usageStyles.centerContent}>
      <Text style={bigNumberPurple}>{yearsIn30}</Text>
      <Text style={typography.styles.light.largeHeading}>YEARS</Text>
      <Text style={typography.styles.light.subheading}>
        spent on your phone
      </Text>
    </View>
  </Animated.View>
);
