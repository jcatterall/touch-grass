import { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../../components/onboarding/OnboardingContainer';
import { spacing, typography } from '../../../theme';
import { Button } from '../../../components';
import UsageStats from '../../../native/UsageStats';

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
          <Text style={typography.styles.light.largeTitle}>📚</Text>
          <Text
            style={{
              ...typography.styles.light.heading,
              ...styles.textCentered,
            }}
          >
            Now, let's uncover your actual screen time
          </Text>
          <Text
            style={{
              ...typography.styles.light.subheading,
              ...styles.textCentered,
            }}
          >
            If you give us the usage access permission, we'll show you how well
            you're staying focused
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button size="lg" onPress={handlePermission}>
          Give permission
        </Button>
        <Pressable onPress={handleSkip}>
          <Text style={{ ...styles.textCentered }}>
            Continue without report
          </Text>
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
  textCentered: {
    textAlign: 'center',
  },
});
