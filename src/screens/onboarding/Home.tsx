import { StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { spacing } from '../../theme';
import { Button, Typography } from '../../components';

export interface PlanProps {
  onComplete: () => void;
}

export const Home = ({ onComplete }: PlanProps) => {
  const handleContinue = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View style={styles.top}>
        <Typography variant="title" center>
          🎉
        </Typography>
      </View>
      <View style={styles.center}>
        <Typography variant="heading" center>
          Expand your mind by walking outside you little
        </Typography>
        <Typography variant="body" center>
          Learn to be a better person with more walking and such, it's just
          better for you.
        </Typography>
      </View>

      <View style={styles.bottom}>
        <Typography variant="body" color="secondary" center>
          Some text would go here
        </Typography>
        <Button size="lg" onPress={handleContinue}>
          Get started
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.xl,
  },
  center: {
    gap: spacing.sm,
  },
  bottom: {
    gap: spacing.xxl,
  },
});
