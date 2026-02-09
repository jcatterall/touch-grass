import { View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography } from '../../components';
import { onboardingStyles as styles } from './onboarding.styles';
import { Illustration } from '../../components/Illustration';

export interface PlanSplashProps {
  onComplete: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

export const PlanSplash = ({ onComplete }: PlanSplashProps) => (
  <OnboardingContainer>
    <View style={styles.flex}>
      <View style={styles.contentCentered}>
        <Illustration source="clock" size="lg" />
        <Typography mode="dark" variant="title" center>
          Let's set up your plan
        </Typography>
      </View>
    </View>
    <Button size="lg" onPress={onComplete}>
      Continue
    </Button>
  </OnboardingContainer>
);
