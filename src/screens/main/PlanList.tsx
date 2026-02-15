import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Typography } from '../../components';
import { storage } from '../../storage';
import { useEffect, useState } from 'react';
import { BlockingPlan } from '../../types';
import { PlanApps } from '../../components/plan/PlanApps';
import { EllipsisVertical } from 'lucide-react-native';
import { colors } from '../../theme';
import { MainScreen } from '../../components/layout/MainScreen';

export interface PlanListProps {
  onClose: () => void;
}

export const PlanList = ({ onClose }: PlanListProps) => {
  const [plans, setPlans] = useState<React.JSX.Element[] | null>(null);

  useEffect(() => {
    const loadData = storage.getPlans();

    Promise.all([loadData]).then(([currentPlans]) => {
      setPlans(currentPlans?.map(plan => planCards(plan)) ?? null);
    });
  }, [setPlans]);

  const planCards = (plan: BlockingPlan) => {
    return (
      <View key={plan.id}>
        <Pressable onPress={() => {}}>
          <Card>
            <View style={styles.cardContainer}>
              <PlanApps apps={plan.blockedApps} />
              <Pressable onPress={() => {}}>
                <EllipsisVertical size={18} color={colors.white} />
              </Pressable>
            </View>
          </Card>
        </Pressable>
      </View>
    );
  };

  return (
    <MainScreen label="Plans" onClose={onClose}>
      <Typography>Plan list goes here</Typography>
      {plans}
    </MainScreen>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
