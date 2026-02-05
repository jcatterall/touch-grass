import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../../components/onboarding/OnboardingContainer';
import { spacing, typography } from '../../../theme';
import { Button } from '../../../components';
import Slider from '../../../components/Slider';
import { useEffect, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

export interface UsageProps {
  usage: number;
  onComplete: () => void;
  setUsage: (value: number) => void;
  onBack?: () => void;
}

export const Usage = ({ usage = 1, onComplete, setUsage }: UsageProps) => {
  const [currentUsage, setCurrentUsage] = useState(usage);
  const animatedUsage = useSharedValue(1);

  useEffect(() => {
    animatedUsage.value = withSpring(currentUsage, {
      damping: 500,
      stiffness: 250,
    });
    setUsage(currentUsage);
  }, [currentUsage, animatedUsage, setUsage]);

  const animatedTextStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(animatedUsage.value, [1, 12], [32, 92]),
    padding: 8,
    minWidth: 120,
    textAlign: 'center',
  }));

  const handleContinue = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View style={{ ...styles.item, gap: spacing.xxxxl }}>
        <Text
          style={{
            ...typography.styles.light.largeHeading,
            ...styles.textCentered,
          }}
        >
          How much time do you spend on your phone every day?
        </Text>
        <View style={styles.slider}>
          <Animated.Text
            style={[typography.styles.light.largeTitle, animatedTextStyle]}
          >
            {currentUsage}h
          </Animated.Text>
          <View>
            <Slider
              min={1}
              max={12}
              value={currentUsage}
              onValueChange={setCurrentUsage}
              showValue={false}
            />
            <View style={styles.sliderLabels}>
              <Text style={typography.styles.light.subheading}>1</Text>
              <Text style={typography.styles.light.subheading}>12+</Text>
            </View>
          </View>
        </View>
      </View>

      <View>
        <Button size="lg" onPress={handleContinue}>
          Continue
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
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  slider: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    width: '100%',
    gap: spacing.xxl,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  textCentered: {
    textAlign: 'center',
  },
  selectWrapper: {
    marginHorizontal: spacing.xxxxl,
    marginTop: spacing.lg, // Optional: adds a bit of breathing room below the subTitle
  },
});
