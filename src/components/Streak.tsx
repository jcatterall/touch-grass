import { View, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import { Typography } from './Typography';
import DailyStreak from './DailyStreak';
import { useStreakData } from '../hooks/useStreakData';

interface StreakProps {
  refreshKey?: number;
  hideStreakCount?: boolean;
}

export const Streak = ({ refreshKey, hideStreakCount }: StreakProps) => {
  const streak = useStreakData(refreshKey);
  if (!streak) return null;

  return (
    <>
      <DailyStreak
        currentStreak={streak.current}
        isTodayComplete={streak.isTodayComplete}
      />

      {!hideStreakCount && (
        <View style={{ marginTop: spacing.md }}>
          <View style={styles.row}>
            <Typography>Current streak</Typography>
            <Typography>{streak.current} days</Typography>
          </View>
          <View style={styles.row}>
            <Typography>Longest streak</Typography>
            <Typography>{streak.longest} days</Typography>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
