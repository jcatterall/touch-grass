import { StyleSheet, Text, View } from 'react-native';
import DailyStreak from '../../components/DailyStreak';
import { spacing, typography } from '../../theme';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button } from '../../components';

export interface StreakProps {
  onComplete: () => void;
}

export const Streak = ({ onComplete }: StreakProps) => {
  const continueClicked = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View style={styles.top}>
        <Text
          style={{
            ...typography.styles.light.largeHeading,
            ...styles.textCentered,
          }}
        >
          🔥
        </Text>
        <Text
          style={{
            ...typography.styles.light.largeHeading,
            ...styles.textCentered,
          }}
        >
          Create a consistent daily routine
        </Text>
        <DailyStreak currentStreak={1} isTodayComplete={true} />
      </View>
      <View>
        <Button size="lg" onPress={continueClicked}>
          Continue
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.xxxxl,
    gap: spacing.xxl,
  },
  icon: {
    textAlign: 'center',
  },
  textCentered: {
    textAlign: 'center',
  },
});
