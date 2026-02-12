import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing } from '../../theme';
import Typography from '../Typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ANIMATION_CONFIG = {
  duration: 500,
  easing: Easing.bezier(0.4, 0.0, 0.2, 1),
};
const MIN_BAR_WIDTH = 110;
const STAGGER_DELAY = 150;

export const UsageComparison = ({
  label,
  value,
  maxValue,
  suffix,
  isReduced,
  index = 0,
}: {
  label: string;
  value: number;
  maxValue: number;
  suffix: string;
  isReduced?: boolean;
  index?: number;
}) => {
  const targetWidth =
    (value / maxValue) * (SCREEN_WIDTH - spacing.lg * 2 - 100);
  const width = useSharedValue(MIN_BAR_WIDTH);

  useEffect(() => {
    width.value = withDelay(
      index * STAGGER_DELAY,
      withTiming(Math.max(targetWidth, MIN_BAR_WIDTH), ANIMATION_CONFIG),
    );
  }, [targetWidth, index, width]);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: width.value,
  }));

  return (
    <View style={styles.barContainer}>
      <View style={styles.barWrapper}>
        <Animated.View
          style={[
            styles.bar,
            animatedBarStyle,
            isReduced ? styles.barReduced : styles.barNormal,
          ]}
        >
          <Typography style={styles.barValue} numberOfLines={1}>
            {suffix}
          </Typography>
        </Animated.View>
        <Typography style={styles.barLabel}>{label}</Typography>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bar: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
  },
  barNormal: {
    backgroundColor: '#FF6B6B',
  },
  barReduced: {
    backgroundColor: '#3478F6',
  },
  barValue: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  barLabel: {
    color: colors.white,
    fontSize: 14,
    marginLeft: spacing.sm,
    flex: 1,
    textAlign: 'right',
    paddingRight: spacing.md,
  },
});
