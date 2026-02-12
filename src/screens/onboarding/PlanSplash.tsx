import { StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography } from '../../components';
import { onboardingStyles } from './onboarding.styles';
import { Illustration } from '../../components/Illustration';
import { spacing } from '../../theme';

export interface PlanSplashProps {
  onComplete: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

export const PlanSplash = ({ onComplete }: PlanSplashProps) => (
  <OnboardingContainer>
    <View style={onboardingStyles.flex}>
      <View style={onboardingStyles.contentCentered}>
        <Illustration source="clock" size="lg" />
        <View style={styles.heading}>
          <Typography variant="title" center>
            Design your daily reset
          </Typography>
          <Typography variant="subtitle" center>
            Create a plan that fits your schedule and keeps you moving
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
