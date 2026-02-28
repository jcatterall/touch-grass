import { useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  AppState,
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
  const completedRef = useRef(false);

  const isNotificationPermissionGranted = useCallback(async () => {
    if (Platform.OS !== 'android' || Platform.Version < 33) {
      return true;
    }

    return PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }, []);

  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    isNotificationPermissionGranted().then(granted => {
      if (granted) {
        completeOnce();
      }
    });

    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      isNotificationPermissionGranted().then(granted => {
        if (granted) {
          completeOnce();
        }
      });
    });

    return () => sub.remove();
  }, [completeOnce, isNotificationPermissionGranted]);

  const handleContinue = () => {
    completeOnce();
  };

  const handleNotification = async () => {
    const granted = await requestNotificationPermission();

    if (granted) {
      completeOnce();
    } else {
      Alert.alert(
        'Permission Optional',
        'TouchGrass can still work without notification permission, but progress notifications may not appear on Android 13+.',
        [
          { text: 'Continue', onPress: completeOnce },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  return (
    <OnboardingContainer>
      <View style={styles.flex}>
        <View style={styles.item}>
          <Illustration source="progress" size="md" />
          <View style={styles.heading}>
            <Typography variant="title" center>
              Track your progress
            </Typography>
            <Typography variant="subtitle" center>
              Receive gentle notifications about your progress and stay
              motivated to reach your goals
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
