import { useCallback, useRef, useState } from 'react';
import { Button, Plan } from '../../components';
import { NestedScreen } from '../../components/layout/NestedScreen';
import { BlockingPlan } from '../../types';
import { storage } from '../../storage';

function isPlanValid(plan: BlockingPlan | null): boolean {
  if (!plan) return false;
  return plan.blockedApps.length > 0 && plan.days.length > 0;
}

interface PlanCreateEditScreenProps {
  onClose: () => void;
  plan: BlockingPlan | null;
}

export const PlanCreateEditScreen = ({
  onClose,
  plan,
}: PlanCreateEditScreenProps) => {
  const editedPlan = useRef<BlockingPlan | null>(plan);
  const [valid, setValid] = useState(() => isPlanValid(plan));
  const isCreate = !plan;

  const handleSave = useCallback(async () => {
    if (!editedPlan.current || !isPlanValid(editedPlan.current)) return;

    isCreate
      ? await storage.createPlan(editedPlan.current)
      : await storage.updatePlan(editedPlan.current);
    onClose();
  }, [onClose, isCreate]);

  const handlePlanChange = useCallback(
    (p: BlockingPlan | null) => {
      editedPlan.current = p && plan ? { ...p, id: plan.id } : p;
      setValid(isPlanValid(editedPlan.current));
    },
    [plan],
  );

  const saveButton = () => {
    return (
      <Button onPress={handleSave} disabled={!valid}>
        {isCreate ? 'Create' : 'Save changes'}
      </Button>
    );
  };

  return (
    <NestedScreen label="Plan" onClose={onClose} footer={saveButton}>
      <Plan plan={plan} onPlanChange={handlePlanChange} />
    </NestedScreen>
  );
};
