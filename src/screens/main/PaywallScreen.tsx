import { Typography } from '../../components';
import { MainScreen } from '../../components/layout/MainScreen';

interface PaywallScreenProps {
  onClose: () => void;
}

export const PaywallScreen = ({ onClose }: PaywallScreenProps) => {
  return (
    <MainScreen label="Paywall" onClose={onClose}>
      <Typography>Paywall screen</Typography>
    </MainScreen>
  );
};
