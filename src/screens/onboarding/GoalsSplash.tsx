import { StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography } from '../../components';
import { onboardingStyles } from './onboarding.styles';
import { Illustration } from '../../components/Illustration';
import { spacing } from '../../theme';

export interface GoalsSplashProps {
  onComplete: () => void;
  onBack?: () => void;
}

export const GoalsSplash = ({ onComplete }: GoalsSplashProps) => (
  <OnboardingContainer>
    <View style={onboardingStyles.flex}>
      <View style={onboardingStyles.contentCentered}>
        <Illustration source="goals" size="lg" />
        <View style={styles.heading}>
          <Typography variant="title" center>
            Let's set you up for success
          </Typography>
          <Typography variant="subtitle" center>
            A few quick questions to build your personalised plan
          </Typography>
        </View>
      </View>
    </View>
    <Button size="lg" onPress={onComplete}>
      Continue
    </Button>
  </OnboardingContainer>
);

const styles = StyleSheet.create({
  heading: {
    gap: spacing.sm,
  },
});
