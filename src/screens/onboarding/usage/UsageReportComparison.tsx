import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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
  <Animated.View
    entering={FadeIn.duration(300)}
    exiting={FadeOut.duration(200)}
    style={usageStyles.slidePage}
  >
    <View style={usageStyles.slideHeader}>
      <Typography variant="heading" center>
        No stress, we've got your back. Let's take a look at your potential.
      </Typography>
      <Typography variant="subtitle" color="secondary" center>
        This is estimated based on our research
      </Typography>
    </View>
    <View style={usageStyles.comparisonSection}>
      <Typography variant="subtitle" mode="dark">
        Time on phone
      </Typography>
      <View style={usageStyles.barsGroup}>
        <UsageComparison
          label="You"
          value={totalHours}
          maxValue={totalHours}
          suffix={`${average.hours}h ${average.minutes}m`}
        />
        <UsageComparison
          label="With TouchGrass"
          value={totalHours / 4}
          maxValue={totalHours}
          suffix={`${reduced.hours}h ${reduced.minutes}m`}
          isReduced
        />
      </View>
    </View>
    <View style={usageStyles.comparisonSection}>
      <Typography variant="subtitle" mode="dark">
        Daily pickups
      </Typography>
      <View style={usageStyles.barsGroup}>
        <UsageComparison
          label="You"
          value={average.pickups}
          maxValue={average.pickups}
          suffix={`${average.pickups}×`}
        />
        <UsageComparison
          label="With TouchGrass"
          value={reduced.pickups}
          maxValue={average.pickups}
          suffix={`${reduced.pickups}×`}
          isReduced
        />
      </View>
    </View>
  </Animated.View>
);
