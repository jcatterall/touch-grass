import { Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { typography } from '../../theme';
import { Button } from '../../components';
import { onboardingStyles as styles } from './onboarding.styles';

export interface GoalsSplashProps {
  onComplete: () => void;
  onBack?: () => void;
}

export const GoalsSplash = ({ onComplete }: GoalsSplashProps) => (
  <OnboardingContainer>
    <View style={styles.flex}>
      <View style={styles.contentCentered}>
        <Text style={typography.styles.light.largeTitle}>🔥</Text>
        <Text style={[typography.styles.light.heading, styles.textCenter]}>
          Set up your goals to help you achieve them
        </Text>
      </View>
    </View>
    <Button size="lg" onPress={onComplete}>
      Continue
    </Button>
  </OnboardingContainer>
);
