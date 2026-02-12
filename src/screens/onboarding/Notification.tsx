import {
  StyleSheet,
  View,
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
} from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography } from '../../components';
import { spacing } from '../../theme';
import { Illustration } from '../../components/Illustration';

interface NotificationProps {
  onComplete: () => void;
  onBack?: () => void;
}

const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }
  return true;
};

export const Notification = ({ onComplete }: NotificationProps) => {
  const handleContinue = () => {
    onComplete();
  };

  const handleNotification = async () => {
    const granted = await requestNotificationPermission();

    if (granted) {
      onComplete();
    } else {
      Alert.alert(
        'Permission Required',
        'Notification access is needed to block unwanted notifications. Please enable it in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  return (
    <OnboardingContainer>
      <View style={styles.flex}>
        <View style={styles.item}>
          <Illustration source="shield" size="md" />
          <View style={styles.heading}>
            <Typography variant="title" center>
              Stay focused, not distracted
            </Typography>
            <Typography variant="subtitle" center>
              Allow notification access so TouchGrass can mute alerts from
              blocked apps during your active plans
            </Typography>
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button size="lg" onPress={handleNotification}>
          Continue
        </Button>
        <Button variant="link" size="lg" onPress={handleContinue}>
          Maybe later
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    gap: spacing.sm,
  },
  bottom: {
    gap: spacing.sm,
  },
});
