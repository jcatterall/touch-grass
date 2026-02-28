import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, AppState, Platform } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography } from '../../components';
import { spacing } from '../../theme';
import { Illustration } from '../../components/Illustration';
import { AppBlocker } from '../../native/AppBlocker';

interface NotificationBlockProps {
  onComplete: () => void;
  onBack?: () => void;
}

export const NotificationBlock = ({ onComplete }: NotificationBlockProps) => {
  const [listenerGranted, setListenerGranted] = useState(false);
  const completedRef = useRef(false);

  const refreshListenerPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setListenerGranted(true);
      return;
    }

    const granted = await AppBlocker.hasNotificationListenerPermission();
    setListenerGranted(granted);
  }, []);

  useEffect(() => {
    refreshListenerPermission();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshListenerPermission();
      }
    });
    return () => sub.remove();
  }, [refreshListenerPermission]);

  useEffect(() => {
    if (!listenerGranted || completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [listenerGranted, onComplete]);

  const handleContinue = () => {
    completedRef.current = true;
    onComplete();
  };

  const handleOpenNotificationAccess = async () => {
    if (Platform.OS !== 'android') return;
    await AppBlocker.requestNotificationListenerPermission();
  };

  const handleNotification = async () => {
    const hasListener =
      Platform.OS !== 'android' ||
      (await AppBlocker.hasNotificationListenerPermission());

    if (hasListener) {
      completedRef.current = true;
      onComplete();
    } else {
      handleOpenNotificationAccess();
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
              Allow access so TouchGrass can mute alerts from blocked apps
              during your active plans
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
