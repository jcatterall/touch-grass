import { StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { spacing } from '../../theme';
import { Button, Typography } from '../../components';
import { Illustration } from '../../components/Illustration';

export interface PlanProps {
  onComplete: () => void;
}

export const Home = ({ onComplete }: PlanProps) => {
  const handleContinue = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View style={styles.imageContainer}>
        <Illustration source="flag" size="lg" />
      </View>
      <View style={styles.center}>
        <Typography variant="heading" center>
          Less scrolling. More living.
        </Typography>
        <Typography variant="subtitle" center>
          Break free from screen addiction by making you earn your app time with
          real movement.
        </Typography>
      </View>

      <View style={styles.spacer} />

      <View style={styles.bottom}>
        <Typography variant="body" center>
          Takes less than 2 minutes to set up
        </Typography>
        <Button size="lg" onPress={handleContinue}>
          Get started
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  center: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  spacer: {
    flex: 1,
  },
  bottom: {
    gap: spacing.xxl,
  },
});
