import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button } from '../../components';

export interface PlanProps {
  onComplete: () => void;
}

export const Plan = ({ onComplete }: PlanProps) => {
  const continueClicked = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View>
        <Text>Plan</Text>
      </View>
      <View>
        <Button size="lg" onPress={continueClicked}>
          Continue
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({});
