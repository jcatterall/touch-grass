import { View } from 'react-native';
import DailyStreak from '../../components/DailyStreak';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography } from '../../components';
import { onboardingStyles } from './onboarding.styles';
import { Illustration } from '../../components/Illustration';

export interface StreakProps {
  onComplete: () => void;
  onBack?: () => void;
}

export const Streak = ({ onComplete }: StreakProps) => (
  <OnboardingContainer>
    <View style={[onboardingStyles.marginTopXxxl, onboardingStyles.gapXxl]}>
      <Illustration source="calendar" size="xs" />
      <Typography variant="heading" center>
        Create a consistent daily routine
      </Typography>
      <DailyStreak currentStreak={1} isTodayComplete={true} />
    </View>
    <Button size="lg" onPress={onComplete}>
      Continue
    </Button>
  </OnboardingContainer>
);
