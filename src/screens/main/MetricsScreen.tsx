import { Typography } from '../../components';
import { MainScreen } from '../../components/layout/MainScreen';

interface MetricsScreenProps {
  onClose: () => void;
}

export const MetricsScreen = ({ onClose }: MetricsScreenProps) => {
  return (
    <MainScreen label="Metrics" onClose={onClose}>
      <Typography variant="heading">Metrics</Typography>
    </MainScreen>
  );
};
