import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, spacing, textStyles } from '../../../theme';
import { Typography } from '../../../components';
import { usageStyles } from './Usage.styles';
import { ArrowDown, ArrowUp } from 'lucide-react-native';

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
      exiting={FadeOut.duration(200)}
      style={usageStyles.slidePage}
    >
      <View style={usageStyles.slideHeader}>
        <Typography variant="heading" center>
          {title}
        </Typography>
        <Typography variant="subtitle" color="secondary" center>
          {subtitle}
        </Typography>
      </View>

      <View style={styles.statsSection}>
        <View style={[styles.iconCircle, { backgroundColor: color }]}>
          <Icon stroke={colors.white} size={32} />
        </View>
        <Text style={textStyles.heading}>
          {formatTime(average.hours, average.minutes)}
        </Text>
        <Text style={[styles.percentText, { color }]}>
          {pct}% {actual < usage ? 'less' : 'more'} than your guess
        </Text>
      </View>

      <View style={styles.barsSection}>
        <View style={styles.barsRow}>
          <View style={styles.barWrapper}>
            <View
              style={[
                styles.bar,
                {
                  height: `${(usage / max) * 100}%`,
                  borderTopColor: colors.white,
                },
              ]}
            />
          </View>
          <View style={styles.barWrapper}>
            <View
              style={[
                styles.bar,
                {
                  height: `${(actual / max) * 100}%`,
                  backgroundColor: color,
                  borderTopColor: color,
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.labelsRow}>
          <View>
            <Typography variant="subtitle">{usage}h 0m</Typography>
            <Typography variant="body" color="secondary">
              Your guess
            </Typography>
          </View>
          <View style={styles.labelRight}>
            <Typography variant="subtitle" style={{ color }}>
              {formatTime(average.hours, average.minutes)}
            </Typography>
            <Typography variant="body" color="secondary">
              Last week avg.
            </Typography>
          </View>
        </View>
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
