import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { spacing, typography } from '../../theme';
import { Button } from '../../components';

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
        <Text style={{ ...typography.styles.light.title, ...styles.fontAlign }}>
          Regain control over your screen time.
        </Text>
      </View>
      <View style={styles.center}>
        <Text style={{ ...styles.fontAlign, ...typography.styles.light.title }}>
          🎉
        </Text>
      </View>
      <View style={styles.bottom}>
        <Button size="lg" onPress={handleContinue}>
          Let's do it
        </Button>
        <Text
          style={{ ...typography.styles.light.caption, ...styles.fontAlign }}
        >
          By proceeding, you agree to our Privacy Policy and Conditions of Use
        </Text>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.xxxl,
  },
  center: {},
  bottom: {
    gap: spacing.xxxl,
  },
  fontAlign: {
    textAlign: 'center',
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.md,
  },
  selectWrapper: {
    marginHorizontal: spacing.xxxxl,
    marginTop: spacing.lg, // Optional: adds a bit of breathing room below the subTitle
  },
});
