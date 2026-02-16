import { StyleSheet, View } from 'react-native';
import { Button, ConfirmModal } from '../../components';
import { storage } from '../../storage';
import { useCallback, useEffect, useState } from 'react';
import { BlockingPlan } from '../../types';
import { MainScreen } from '../../components/layout/MainScreen';
import { Copy, Pause, Play, Pencil, Trash2 } from 'lucide-react-native';

import { PlanCreateEditScreen } from './PlanCreateEditScreen';
import { spacing } from '../../theme';
import { PlanListCard } from '../../components/plan/PlanListCard';
import { Illustration } from '../../components/Illustration';

export interface PlanListProps {
  onClose: () => void;
}

export const PlanList = ({ onClose }: PlanListProps) => {
  const [plans, setPlans] = useState<BlockingPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activePlan, setActivePlan] = useState<BlockingPlan | 'create' | null>(
    null,
  );
  const [deletePlan, setDeletePlan] = useState<BlockingPlan | null>(null);

  const loadPlans = useCallback(() => {
    storage.getPlans().then(currentPlans => {
      setPlans(currentPlans);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const hasPlans = plans.length > 0;

  const handleClose = () => {
    storage.getPlans().then(currentPlans => {
      setPlans(currentPlans);
      setActivePlan(null);
    });
  };

  const handleDeletePlan = (plan: BlockingPlan) => {
    storage.deletePlan(plan.id).then(() => {
      loadPlans();
    });
  };

  const menuItems = (plan: BlockingPlan) => [
    { label: 'Edit', icon: Pencil, onPress: () => setActivePlan(plan) },
    {
      label: 'Duplicate',
      icon: Copy,
      onPress: () => {
        storage.duplicatePlan(plan.id).then(loadPlans);
      },
    },
    {
      label: plan.active ? 'Pause' : 'Resume',
      icon: plan.active ? Pause : Play,
      onPress: () => {
        storage.togglePlanActive(plan.id).then(loadPlans);
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      destructive: true,
      onPress: () => setDeletePlan(plan),
    },
  ];

  const createPlanButton = () => {
    return hasPlans ? (
      <Button size="sm" onPress={() => setActivePlan('create')}>
        Add
      </Button>
    ) : null;
  };

  return (
    <MainScreen label="Plans" onClose={onClose} header={createPlanButton()}>
      {!loaded ? null : hasPlans ? (
        <View style={styles.cardContainer}>
          {plans.map(plan => (
            <PlanListCard
              key={plan.id}
              plan={plan}
              menuItems={menuItems}
              onPress={setActivePlan}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Illustration size="xs" source="chest" />
          <Button onPress={() => setActivePlan('create')}>
            Add your first plan
          </Button>
        </View>
      )}

      {activePlan && (
        <PlanCreateEditScreen
          plan={activePlan === 'create' ? null : activePlan}
          onClose={handleClose}
        />
      )}

      <ConfirmModal
        visible={!!deletePlan}
        onClose={() => setDeletePlan(null)}
        title="Delete plan?"
        subtitle="This action can't be undone"
        confirmLabel="Delete plan"
        onConfirm={() => handleDeletePlan(deletePlan!)}
      />
    </MainScreen>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    gap: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    marginTop: spacing.xxl,
    gap: spacing.sm,
    alignContent: 'center',
    alignItems: 'center',
  },
});
