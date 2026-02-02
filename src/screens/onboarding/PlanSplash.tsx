import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { spacing, typography } from '../../theme';
import { Button } from '../../components';

export interface PlanSplashProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const PlanSplash = ({ onComplete }: PlanSplashProps) => {
  const handleContinue = () => {
    onComplete();
  };

  // const handleSkip = () => {
  //   onSkip();
  // };

  return (
    <OnboardingContainer>
      <View style={styles.flex}>
        <View style={styles.item}>
          <Text style={typography.styles.light.largeTitle}>📚</Text>
          <Text
            style={{
              ...typography.styles.light.heading,
              ...styles.textCentered,
            }}
          >
            Let's set up your plan
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button size="lg" onPress={handleContinue}>
          Continue
        </Button>
        {/* <Pressable onPress={handleSkip}>
          <Text style={{ ...styles.textAligned }}>Skip for now</Text>
        </Pressable> */}
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
  bottom: {
    gap: spacing.lg,
  },
  textCentered: {
    textAlign: 'center',
  },
});
