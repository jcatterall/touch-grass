import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Typography } from '../../../components';
import {
  usageStyles,
  createBigNumberStyle,
  bigNumberColors,
} from './Usage.styles';

const bigNumberGreen = createBigNumberStyle(bigNumberColors.green);

export const UsageFirstWeek = () => (
  <Animated.View
    entering={FadeIn.duration(300)}
    exiting={FadeOut.duration(200)}
    style={usageStyles.slidePage}
  >
    <View style={usageStyles.slideHeader}>
      <Typography variant="heading" center>
        The first week is the most important for changing your habits.
      </Typography>
      <Typography variant="subtitle" color="secondary" center>
        AppBlock can help cut down the time on your phone by up to 32% in the
        first week of use.
      </Typography>
    </View>
    <View style={usageStyles.centerContent}>
      <Text style={bigNumberGreen}>32%</Text>
    </View>
  </Animated.View>
);
