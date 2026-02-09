import { StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../../components/onboarding/OnboardingContainer';
import { colors, spacing, textStyles } from '../../../theme';
import { Button, Typography } from '../../../components';
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

  const animatedTextStyle = useAnimatedStyle(() => {
    const fontSize = interpolate(animatedUsage.value, [1, 12], [32, 92]);
    return {
      fontSize,
      lineHeight: fontSize * 1.2,
      color: colors.skyBlue,
      minWidth: 100,
      textAlign: 'center' as const,
    };
  });

  const handleContinue = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View style={{ ...styles.item, gap: spacing.xxxxl }}>
        <View style={styles.header}>
          <Typography mode="dark" variant="heading" center>
            How much time do you spend on your phone every day?
          </Typography>
        </View>

        <View style={styles.slider}>
          <View style={styles.textContainer}>
            <Animated.Text style={[textStyles.title, animatedTextStyle]}>
              {currentUsage}h
            </Animated.Text>
          </View>
          <View>
            <Slider
              mode="light"
              min={1}
              max={12}
              value={currentUsage}
              onValueChange={setCurrentUsage}
              showValue={false}
            />
            <View style={styles.sliderLabels}>
              <Typography mode="dark" variant="subtitle">
                1
              </Typography>
              <Typography mode="dark" variant="subtitle">
                12+
              </Typography>
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
  header: {
    marginTop: spacing.xl,
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
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
});
