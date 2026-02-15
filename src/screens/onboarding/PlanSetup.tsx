import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography, Plan } from '../../components';
import { spacing } from '../../theme';
import { triggerHaptic } from '../../utils/haptics';
import { BlockingPlan } from '../../types';

export interface PlanSetupProps {
  onComplete: (plan: BlockingPlan) => void;
  plan: BlockingPlan | null;
}

export const PlanSetup = ({ onComplete, plan }: PlanSetupProps) => {
  const [currentPlan, setCurrentPlan] = useState<BlockingPlan | null>(null);

  const handlePlanChange = useCallback(
    (p: BlockingPlan | null) => setCurrentPlan(p),
    [],
  );

  const handleSave = () => {
    if (!currentPlan) return;
    triggerHaptic('impactMedium');
    onComplete(currentPlan);
  };

  return (
    <OnboardingContainer>
      <View style={styles.container}>
        <Typography variant="title">
          {plan ? 'Edit plan' : 'Your plan'}
        </Typography>

        <Plan plan={plan} onPlanChange={handlePlanChange} />
      </View>
      <View style={styles.footer}>
        <Button size="lg" onPress={handleSave} disabled={!currentPlan}>
          {plan ? 'Save Changes' : 'Continue'}
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  footer: {
    paddingTop: spacing.md,
  },
});
