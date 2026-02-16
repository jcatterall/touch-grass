import { StyleSheet, View } from 'react-native';
import { Card } from '../Card';
import { PlanApps } from './PlanApps';
import Typography from '../Typography';
import {
  getActiveScheduleTimeText,
  getScheduleDaysText,
} from '../../utils/plan.utils';
import { Menu } from '../Menu';
import { BlockingPlan } from '../../types';
import { OverlayMenuItem } from '../OverlayMenu';
import { colors } from '../../theme';

interface PlanListCardProps {
  plan: BlockingPlan;
  menuItems: (plan: BlockingPlan) => OverlayMenuItem[];
  onPress: (plan: BlockingPlan) => void;
}

export const PlanListCard = ({
  plan,
  menuItems,
  onPress,
}: PlanListCardProps) => {
  return (
    <View key={plan.id}>
      <Card
        hideChevron
        onPress={() => onPress(plan)}
        style={plan.active ? styles.activeBorder : undefined}
      >
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
  );
};

const styles = StyleSheet.create({
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
  activeBorder: {
    borderWidth: 2,
    borderColor: colors.meadowGreen,
  },
});
