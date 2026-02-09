/**
 * DailyStreak - Displays current streak with weekly progress indicators
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/tokens';
import { Typography } from './Typography';

// Types
export interface DailyStreakProps {
  currentStreak: number;
  isTodayComplete: boolean;
}

interface DayIndicatorProps {
  day: string;
  isCompleted: boolean;
  isToday: boolean;
}

// Constants
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Helper functions - decoupled for testing
export const getTodayIndex = (): number => {
  const dayIndex = new Date().getDay();
  // Convert Sunday = 0 to our Mon-Sun array index
  return dayIndex === 0 ? 6 : dayIndex - 1;
};

export const getCompletedDays = (
  currentStreak: number,
  isTodayComplete: boolean,
): Set<string> => {
  const todayIndex = getTodayIndex();
  const completed = new Set<string>();

  // Calculate how many past days in this week are part of the streak
  const streakDaysThisWeek = Math.min(
    currentStreak - (isTodayComplete ? 1 : 0),
    todayIndex,
  );

  // Mark past days as completed based on streak
  for (let i = todayIndex - streakDaysThisWeek; i < todayIndex; i++) {
    if (i >= 0) {
      completed.add(DAYS_OF_WEEK[i]);
    }
  }

  // Add today if complete
  if (isTodayComplete) {
    completed.add(DAYS_OF_WEEK[todayIndex]);
  }

  return completed;
};

// Sub-components
const DayIndicator: React.FC<DayIndicatorProps> = ({
  day,
  isCompleted,
  isToday,
}) => {
  const containerStyle = [
    styles.dayContainer,
    isCompleted && styles.dayContainerCompleted,
    !isCompleted && styles.dayContainerIncomplete,
    isToday && !isCompleted && styles.dayContainerToday,
  ];

  return (
    <View style={styles.dayWrapper}>
      <Typography
        mode="light"
        variant="body"
        color={isCompleted ? 'primary' : 'tertiary'}
        style={styles.dayLabel}
      >
        {day}
      </Typography>
      <View style={containerStyle}>
        {isCompleted ? (
          <BadgeCheck
            size={32}
            color={colors.white}
            fill={colors.primary60}
            strokeWidth={2}
          />
        ) : (
          <></>
        )}
      </View>
    </View>
  );
};

// Main component
export const DailyStreak: React.FC<DailyStreakProps> = ({
  currentStreak,
  isTodayComplete,
}) => {
  const todayIndex = getTodayIndex();
  const today = DAYS_OF_WEEK[todayIndex];
  const completedDays = getCompletedDays(currentStreak, isTodayComplete);

  return (
    <View style={styles.card}>
      <View style={styles.weekContainer}>
        {DAYS_OF_WEEK.map(day => (
          <DayIndicator
            key={day}
            day={day}
            isCompleted={completedDays.has(day)}
            isToday={day === today}
          />
        ))}
      </View>
      <Typography variant="body" center style={styles.caption}>
        Build a streak, one day at a time
      </Typography>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral10,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    ...shadows.md,
  },
  caption: {
    marginTop: spacing.lg,
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  dayContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  dayContainerCompleted: {
    backgroundColor: 'transparent',
  },
  dayContainerIncomplete: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.neutral30,
  },
  dayContainerToday: {
    borderColor: colors.primary60,
    borderWidth: 2,
  },
  dayLabel: {
    fontWeight: '800',
  },
});

export default DailyStreak;
