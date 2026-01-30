import { StyleSheet, Text, View } from 'react-native';
import { Main } from '../../layout/Main';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { spacing, typography } from '../../theme';
import { Button } from '../../components';

export interface PlanProps {
  onComplete: () => void;
}

export const Usage = ({ onComplete }: PlanProps) => {
  const handleContinue = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View>
        <View></View>
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
    gap: spacing.md,
  },
  selectWrapper: {
    marginHorizontal: spacing.xxxxl,
    marginTop: spacing.lg, // Optional: adds a bit of breathing room below the subTitle
  },
});
