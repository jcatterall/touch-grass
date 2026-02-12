import { useEffect } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Typography } from '../../components';
import { colors, spacing } from '../../theme';
import { CircleCheck } from 'lucide-react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface PlanBuildingProps {
  onComplete: () => void;
}

const STEPS = [
  'Analyzing your screen time habits',
  'Identifying your biggest distractions',
  'Setting up your app blocking schedule',
  'Configuring your walking goals',
];

const SIZE = 200;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const HALF = SIZE / 2;

export const PlanBuilding = ({ onComplete }: PlanBuildingProps) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(0.75, { duration: 7000, easing: Easing.out(Easing.quad) }),
      withTiming(0.97, { duration: 7000, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
    );
    const t = setTimeout(onComplete, 16000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = useDerivedValue(() => `${Math.round(progress.value * 100)}%`);
  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - progress.value),
  }));

  return (
    <OnboardingContainer>
      <View style={styles.content}>
        <View style={styles.ring}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={HALF}
              cy={HALF}
              r={R}
              stroke={colors.neutral20}
              strokeWidth={STROKE}
              fill="none"
            />
            <G transform={`rotate(-90, ${HALF}, ${HALF})`}>
              <AnimatedCircle
                cx={HALF}
                cy={HALF}
                r={R}
                stroke={colors.primary60}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={C}
                animatedProps={circleProps}
              />
            </G>
          </Svg>
          <View style={styles.pctOverlay}>
            <PercentText value={pct} />
          </View>
        </View>

        <Typography mode="dark" variant="heading" style={styles.title}>
          Creating Your Plan
        </Typography>

        <View style={styles.steps}>
          {STEPS.map((label, i) => (
            <Animated.View
              key={i}
              entering={FadeIn.delay(i * 3000 + 1000).duration(500)}
              style={styles.row}
            >
              <CircleCheck
                size={20}
                color={colors.neutral.white}
                stroke={colors.neutral.white}
              />
              <Typography mode="dark" variant="body" style={styles.label}>
                {label}
              </Typography>
            </Animated.View>
          ))}
        </View>
      </View>
      <View />
    </OnboardingContainer>
  );
};

const PercentText = ({ value }: { value: SharedValue<string> }) => {
  const animatedProps = useAnimatedProps(() => ({
    text: value.value,
    defaultValue: '0%',
  }));
  return (
    <AnimatedTextInput
      style={styles.pct}
      animatedProps={animatedProps}
      editable={false}
      underlineColorAndroid="transparent"
    />
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  pctOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    padding: 0,
  },
  title: { textAlign: 'center', marginBottom: spacing.xl },
  steps: {
    alignSelf: 'stretch',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { color: colors.white },
});
