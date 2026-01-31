import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { spacing, typography } from '../../theme';
import { Button } from '../../components';

export interface GoalsSplashProps {
  onComplete: () => void;
}

export const GoalsSplash = ({ onComplete }: GoalsSplashProps) => {
  const handleContinue = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View style={styles.flex}>
        <View style={styles.item}>
          <Text style={typography.styles.light.largeTitle}>🔥</Text>
          <Text
            style={{
              ...typography.styles.light.heading,
              ...styles.textAligned,
            }}
          >
            Set up your goals to help you achieve them
          </Text>
        </View>
      </View>

      <View>
        <Button size="lg" onPress={handleContinue}>
          Continue
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textAligned: {
    textAlign: 'center',
  },
});
