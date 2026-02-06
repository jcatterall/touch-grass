import { View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Typography } from '../../../components';
import { UsageComparison } from '../../../components/usage/UsageComparison';
import { usageStyles } from './Usage.styles';

interface UsageReportComparisonProps {
  totalHours: number;
  average: {
    hours: number;
    minutes: number;
    pickups: number;
  };
  reduced: {
    hours: number;
    minutes: number;
    pickups: number;
  };
}

export const UsageReportComparison = ({
  totalHours,
  average,
  reduced,
}: UsageReportComparisonProps) => (
  <Animated.View entering={FadeIn.duration(300)} style={usageStyles.slidePage}>
    <View style={usageStyles.slideHeader}>
      <Typography variant="heading" center>
        No stress, we've got your back. Let's take a look at your potential.
      </Typography>
      <Typography variant="subtitle" color="secondary" center>
        This is estimated based on our research
      </Typography>
    </View>
    <Animated.View
      entering={FadeInUp.delay(100).duration(400)}
      style={usageStyles.comparisonSection}
    >
      <Typography variant="subtitle" mode="light">
        Time on phone
      </Typography>
      <View style={usageStyles.barsGroup}>
        <UsageComparison
          label="You"
          value={totalHours}
          maxValue={totalHours}
          suffix={`${average.hours}h ${average.minutes}m`}
          index={0}
        />
        <UsageComparison
          label="With TouchGrass"
          value={totalHours / 4}
          maxValue={totalHours}
          suffix={`${reduced.hours}h ${reduced.minutes}m`}
          isReduced
          index={1}
        />
      </View>
    </Animated.View>
    <Animated.View
      entering={FadeInUp.delay(300).duration(400)}
      style={usageStyles.comparisonSection}
    >
      <Typography variant="subtitle" mode="light">
        Daily pickups
      </Typography>
      <View style={usageStyles.barsGroup}>
        <UsageComparison
          label="You"
          value={average.pickups}
          maxValue={average.pickups}
          suffix={`${average.pickups}×`}
          index={2}
        />
        <UsageComparison
          label="With TouchGrass"
          value={reduced.pickups}
          maxValue={average.pickups}
          suffix={`${reduced.pickups}×`}
          isReduced
          index={3}
        />
      </View>
    </Animated.View>
  </Animated.View>
);
