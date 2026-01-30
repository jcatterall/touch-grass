import { Text } from 'react-native';
import { Main } from '../../layout/Main';

export interface PlanProps {
  onComplete: () => void;
}

export const Plan = ({ onComplete }: PlanProps) => {
  return (
    <Main>
      <Text>Plan</Text>
    </Main>
  );
};
