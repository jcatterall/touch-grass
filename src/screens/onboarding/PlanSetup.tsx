import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography, Plan } from '../../components';
import { BlocklistScreen, type AppItem } from '../BlocklistScreen';
import { spacing } from '../../theme';
import { triggerHaptic } from '../../utils/haptics';
import { BlockingPlan } from '../../types';

export interface PlanSetupProps {
  onComplete: (plan: BlockingPlan) => void;
  plan: BlockingPlan | null;
}

export const PlanSetup = ({ onComplete, plan }: PlanSetupProps) => {
  const [currentPlan, setCurrentPlan] = useState<BlockingPlan | null>(null);
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blockedApps, setBlockedApps] = useState<AppItem[]>(
    (plan?.blockedApps as unknown as AppItem[]) ?? [],
  );

  const handlePlanChange = useCallback(
    (p: BlockingPlan | null) => setCurrentPlan(p),
    [],
  );

  const handleSave = () => {
    if (!currentPlan) return;
    triggerHaptic('impactMedium');
    onComplete(currentPlan);
  };

  if (showBlocklist) {
    return (
      <BlocklistScreen
        selectedApps={blockedApps}
        onSave={apps => {
          setBlockedApps(apps);
          setShowBlocklist(false);
        }}
        onClose={() => setShowBlocklist(false)}
      />
    );
  }

  return (
    <OnboardingContainer>
      <View style={styles.container}>
        <Typography variant="title">
          {plan ? 'Edit plan' : 'Your plan'}
        </Typography>

        <Plan
          plan={plan}
          blockedApps={blockedApps}
          onEditApps={() => setShowBlocklist(true)}
          onPlanChange={handlePlanChange}
        />
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
