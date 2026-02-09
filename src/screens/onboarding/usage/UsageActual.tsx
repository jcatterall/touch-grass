import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, textStyles } from '../../../theme';
import { Typography } from '../../../components';
import { usageStyles } from './Usage.styles';
import { ArrowDown, ArrowUp } from 'lucide-react-native';

const ANIMATION_CONFIG = {
  duration: 500,
  easing: Easing.bezier(0.4, 0.0, 0.2, 1),
};
const BAR_HEIGHT = 100;

interface AnimatedBarProps {
  heightPercent: number;
  index: number;
  backgroundColor: string;
  borderTopColor: string;
}

const AnimatedComparisonBar = ({
  heightPercent,
  index,
  backgroundColor,
  borderTopColor,
}: AnimatedBarProps) => {
  const height = useSharedValue(0);

  useEffect(() => {
    const targetHeight = (heightPercent / 100) * BAR_HEIGHT;
    height.value = withDelay(
      index * 150,
      withTiming(targetHeight, ANIMATION_CONFIG),
    );
  }, [heightPercent, index, height]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    backgroundColor,
    borderTopColor,
  }));

  return <Animated.View style={[styles.bar, animatedStyle]} />;
};

interface UsageActualProps {
  usage: number;
  average: { hours: number; minutes: number };
}

const formatTime = (h: number, m: number) => `${h}h ${m}m`;

const content = {
  less: {
    title: 'Less screen time than you thought!',
    subtitle: "Nice surprise – you're more in control than you realized.",
    color: '#2ECC71',
    Icon: ArrowDown,
  },
  more: {
    title: 'More screen time than you thought!',
    subtitle:
      "That's okay – recognizing the issue is the first step to change.",
    color: '#FF6B6B',
    Icon: ArrowUp,
  },
};

export const UsageActual = ({ usage, average }: UsageActualProps) => {
  const actual = average.hours + average.minutes / 60;
  const max = Math.max(actual, usage);
  const { title, subtitle, color, Icon } =
    content[actual < usage ? 'less' : 'more'];
  const pct = Math.round((Math.abs(usage - actual) / usage) * 100);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={usageStyles.slidePage}
    >
      <View style={usageStyles.slideHeader}>
        <Typography mode="dark" variant="heading" center>
          {title}
        </Typography>
        <Typography mode="dark" variant="subtitle" color="secondary" center>
          {subtitle}
        </Typography>
      </View>

      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        style={styles.statsSection}
      >
        <View style={[styles.iconCircle, { backgroundColor: color }]}>
          <Icon stroke={colors.white} size={32} />
        </View>
        <Typography mode="dark" style={textStyles.heading}>
          {formatTime(average.hours, average.minutes)}
        </Typography>
        <Text style={[styles.percentText, { color }]}>
          {pct}% {actual < usage ? 'less' : 'more'} than your guess
        </Text>
      </Animated.View>

      <View style={styles.barsSection}>
        <View style={styles.barsRow}>
          <View style={styles.barWrapper}>
            <AnimatedComparisonBar
              heightPercent={(usage / max) * 100}
              index={0}
              backgroundColor={colors.dark50}
              borderTopColor={colors.white}
            />
          </View>
          <View style={styles.barWrapper}>
            <AnimatedComparisonBar
              heightPercent={(actual / max) * 100}
              index={1}
              backgroundColor={color}
              borderTopColor={color}
            />
          </View>
        </View>
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={styles.labelsRow}
        >
          <View>
            <Typography mode="dark" variant="subtitle">
              {usage}h 0m
            </Typography>
            <Typography mode="dark" variant="body" color="secondary">
              Your guess
            </Typography>
          </View>
          <View style={styles.labelRight}>
            <Typography mode="dark" variant="subtitle" style={{ color }}>
              {formatTime(average.hours, average.minutes)}
            </Typography>
            <Typography mode="dark" variant="body" color="secondary">
              Last week avg.
            </Typography>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  statsSection: { alignItems: 'center', gap: spacing.sm },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentText: { fontSize: 18, fontWeight: '600' },
  barsSection: { gap: spacing.sm },
  barsRow: { flexDirection: 'row', gap: spacing.sm },
  barWrapper: {
    flex: 1,
    height: 100,
    backgroundColor: colors.dark70,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: colors.dark50,
    borderTopWidth: 3,
  },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  labelRight: { alignItems: 'flex-end' },
});
