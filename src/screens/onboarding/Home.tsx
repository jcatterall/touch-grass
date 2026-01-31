import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { spacing, typography } from '../../theme';
import { Button } from '../../components';

export interface PlanProps {
  onComplete: () => void;
}

export const Home = ({ onComplete }: PlanProps) => {
  const handleContinue = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View style={styles.top}>
        <Text style={{ ...styles.fontAlign, ...typography.styles.light.title }}>
          🎉
        </Text>
      </View>
      <View style={styles.center}>
        <Text
          style={{
            ...typography.styles.light.largeHeading,
            ...styles.fontAlign,
          }}
        >
          Expand your mind by walking outside you little
        </Text>
        <Text
          style={{
            ...typography.styles.light.body,
            ...styles.fontAlign,
          }}
        >
          Learn to be a better person with more walking and such, it's just
          better for you.
        </Text>
      </View>

      <View style={styles.bottom}>
        <Text
          style={{ ...typography.styles.light.caption, ...styles.fontAlign }}
        >
          Some text would go here
        </Text>
        <Button size="lg" onPress={handleContinue}>
          Get started
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.xl,
  },
  center: {
    gap: spacing.sm,
  },
  bottom: {
    gap: spacing.xxl,
  },
  fontAlign: {
    textAlign: 'center',
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.md,
  },
  selectWrapper: {
    marginHorizontal: spacing.xxxxl,
    marginTop: spacing.lg, // Optional: adds a bit of breathing room below the subTitle
  },
});
