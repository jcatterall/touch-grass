import { View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography } from '../../components';
import { onboardingStyles as styles } from './onboarding.styles';
import { Illustration } from '../../components/Illustration';

export interface GoalsSplashProps {
  onComplete: () => void;
  onBack?: () => void;
}

export const GoalsSplash = ({ onComplete }: GoalsSplashProps) => (
  <OnboardingContainer>
    <View style={styles.flex}>
      <View style={styles.contentCentered}>
        <Illustration source="goals" size="lg" />
        <Typography mode="dark" variant="title" center>
          Set up your goals to help you achieve them
        </Typography>
      </View>
    </View>
    <Button size="lg" onPress={onComplete}>
      Continue
    </Button>
  </OnboardingContainer>
);
