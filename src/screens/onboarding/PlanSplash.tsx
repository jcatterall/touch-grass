import { Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { typography } from '../../theme';
import { Button } from '../../components';
import { onboardingStyles as styles } from './onboarding.styles';

export interface PlanSplashProps {
  onComplete: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

export const PlanSplash = ({ onComplete }: PlanSplashProps) => (
  <OnboardingContainer>
    <View style={styles.flex}>
      <View style={styles.contentCentered}>
        <Text style={typography.styles.light.largeTitle}>📚</Text>
        <Text style={[typography.styles.light.heading, styles.textCenter]}>
          Let's set up your plan
        </Text>
      </View>
    </View>
    <Button size="lg" onPress={onComplete}>
      Continue
    </Button>
  </OnboardingContainer>
);
