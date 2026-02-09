import { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../../components/onboarding/OnboardingContainer';
import { spacing } from '../../../theme';
import { Button, Typography } from '../../../components';
import UsageStats from '../../../native/UsageStats';
import { Illustration } from '../../../components/Illustration';

export interface UsagePermissionsProps {
  onComplete: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

export const UsagePermissions = ({
  onComplete,
  onSkip,
}: UsagePermissionsProps) => {
  const pendingPermission = useRef(false);

  useEffect(() => {
    const hasPermissions = async () => {
      const hasPermission = await UsageStats.hasPermission();
      if (hasPermission) {
        onComplete();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      async nextState => {
        if (nextState === 'active' && pendingPermission.current) {
          pendingPermission.current = false;
          await hasPermissions();
        }
      },
    );

    return () => subscription.remove();
  }, [onComplete]);

  const handlePermission = async () => {
    const hasPermission = await UsageStats.hasPermission();
    if (hasPermission) {
      onComplete();
    } else {
      pendingPermission.current = true;
      await UsageStats.requestPermission();
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <OnboardingContainer>
      <View style={styles.flex}>
        <View style={styles.item}>
          <View style={styles.top}>
            <View style={styles.imageContainer}>
              <Illustration source="clock" size="lg" />
            </View>
            <Typography mode="dark" variant="title" center>
              Now, let's uncover your actual screen time
            </Typography>
          </View>

          <Typography mode="dark" variant="subtitle" color="secondary" center>
            If you give us the usage access permission, we'll show you how well
            you're staying focused
          </Typography>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button size="lg" onPress={handlePermission}>
          Give permission
        </Button>
        <Pressable onPress={handleSkip}>
          <Typography mode="dark" variant="body" color="secondary" center>
            Continue without report
          </Typography>
        </Pressable>
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
  bottom: {
    gap: spacing.lg,
  },
  top: {
    width: '100%',
  },
  imageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
