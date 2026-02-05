import { StyleSheet, Text, View } from 'react-native';
import DailyStreak from '../../components/DailyStreak';
import { typography } from '../../theme';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button } from '../../components';
import { onboardingStyles } from './onboarding.styles';

export interface StreakProps {
  onComplete: () => void;
  onBack?: () => void;
}

export const Streak = ({ onComplete }: StreakProps) => (
  <OnboardingContainer>
    <View style={[onboardingStyles.marginTopXxxl, onboardingStyles.gapXxl]}>
      <Text style={[typography.styles.light.largeHeading, onboardingStyles.textCenter]}>
        🔥
      </Text>
      <Text style={[typography.styles.light.largeHeading, onboardingStyles.textCenter]}>
        Create a consistent daily routine
      </Text>
      <DailyStreak currentStreak={1} isTodayComplete={true} />
    </View>
    <Button size="lg" onPress={onComplete}>
      Continue
    </Button>
  </OnboardingContainer>
);
