import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { typography } from '../../../theme';
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
      <Text
        style={[typography.styles.light.largeHeading, usageStyles.textCentered]}
      >
        No stress, we've got your back. Let's take a look at your potential.
      </Text>
      <Text style={[typography.styles.light.body, usageStyles.textCentered]}>
        This is estimated based on our research
      </Text>
    </View>
    <View style={usageStyles.comparisonSection}>
      <Text style={typography.styles.dark.subheading}>Time on phone</Text>
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
      <Text style={typography.styles.dark.subheading}>Daily pickups</Text>
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
