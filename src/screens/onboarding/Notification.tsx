import {
  StyleSheet,
  Text,
  View,
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
} from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button } from '../../components';
import { spacing, typography } from '../../theme';

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
    // Android < 13 doesn't require runtime permission for notifications
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
          <Text style={typography.styles.light.largeTitle}>🔔</Text>
          <View style={styles.heading}>
            <Text
              style={{
                ...typography.styles.light.heading,
                ...styles.textAligned,
              }}
            >
              Block unwanted notifications
            </Text>
            <Text
              style={{
                ...typography.styles.light.subheading,
                ...styles.textAligned,
              }}
            >
              Grant notification access to block any unwanted notifications
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button size="lg" onPress={handleNotification}>
          Block notifications
        </Button>
        <Button variant="secondary" size="lg" onPress={handleContinue}>
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
  textAligned: {
    textAlign: 'center',
  },
  bottom: {
    gap: spacing.sm,
  },
});
