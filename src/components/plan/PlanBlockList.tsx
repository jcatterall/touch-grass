import { View } from 'react-native';
import { Typography } from '../Typography';
import { Card } from '../Card';
import { PlanApps } from './PlanApps';

export interface BlockedApp {
  name: string;
  icon?: string;
}

export interface PlanBlockListProps {
  apps: BlockedApp[];
  onEdit?: () => void;
}

export const PlanBlockList = ({ apps, onEdit }: PlanBlockListProps) => {
  const hasApps = apps.length > 0;

  return (
    <View>
      {hasApps ? (
        <Card onPress={onEdit}>
          <PlanApps apps={apps} />
        </Card>
      ) : (
        <Card onPress={onEdit} variant="secondary">
          <View>
            <Typography>Select apps to block</Typography>
          </View>
        </Card>
      )}
    </View>
  );
};
