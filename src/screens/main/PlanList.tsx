import { StyleSheet, View } from 'react-native';
import { Button, Card, ConfirmModal, Typography } from '../../components';
import { storage } from '../../storage';
import { useCallback, useEffect, useState } from 'react';
import { BlockingPlan } from '../../types';
import { PlanApps } from '../../components/plan/PlanApps';
import { MainScreen } from '../../components/layout/MainScreen';
import { Menu } from '../../components/Menu';
import {
  getActiveScheduleTimeText,
  getScheduleDaysText,
} from '../../utils/plan.utils';
import { PlanCreateEditScreen } from './PlanCreateEditScreen';
import { spacing } from '../../theme';

export interface PlanListProps {
  onClose: () => void;
}

export const PlanList = ({ onClose }: PlanListProps) => {
  const [plans, setPlans] = useState<BlockingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<BlockingPlan | 'create' | null>(
    null,
  );
  const [deletePlan, setDeletePlan] = useState<BlockingPlan | null>(null);

  const loadPlans = useCallback(() => {
    storage.getPlans().then(currentPlans => {
      setPlans(currentPlans);
    });
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleClose = () => {
    setActivePlan(null);
    loadPlans();
  };

  const handleDeletePlan = (plan: BlockingPlan) => {
    storage.deletePlan(plan.id).then(() => {
      loadPlans();
    });
  };

  const menuItems = (plan: BlockingPlan) => [
    { label: 'Edit', onPress: () => setActivePlan(plan) },
    { label: 'Duplicate', onPress: () => {} },
    { label: 'Pause', onPress: () => {} },
    { label: 'Delete', onPress: () => setDeletePlan(plan) },
  ];

  const createPlanButton = () => {
    return (
      <Button size="sm" onPress={() => setActivePlan('create')}>
        Add
      </Button>
    );
  };

  return (
    <MainScreen label="Plans" onClose={onClose} header={createPlanButton()}>
      <View style={styles.cardContainer}>
        {plans.map(plan => (
          <View key={plan.id}>
            <Card hideChevron onPress={() => setActivePlan(plan)}>
              <View>
                <View style={styles.cardTop}>
                  <PlanApps apps={plan.blockedApps} />
                  <Menu items={menuItems(plan)} />
                </View>
                <View style={styles.cardBottom}>
                  <Typography style={styles.textCentered}>
                    {getActiveScheduleTimeText(plan)}
                  </Typography>
                  <Typography style={styles.textCentered} color="tertiary">
                    {getScheduleDaysText(plan)}
                  </Typography>
                </View>
              </View>
            </Card>
          </View>
        ))}
      </View>

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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBottom: {
    alignSelf: 'center',
  },
  textCentered: {
    textAlign: 'center',
  },
});
