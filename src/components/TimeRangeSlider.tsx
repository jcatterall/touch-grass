/**
 * TimeRangeSlider - A dual-thumb slider for selecting a time range
 */

import React, { useCallback, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Clock } from 'lucide-react-native';

import { triggerHaptic } from '../utils/haptics';
import { colors, spacing } from '../theme';
import { Shadows } from '../theme/theme';

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 6;
const MIN_TIME = 0; // 12:00 AM in minutes
const MAX_TIME = 24 * 60 - 1; // 11:59 PM in minutes
const STEP = 15; // 15 minute increments

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

export interface TimeRangeSliderProps {
  startTime: string; // Format: "HH:MM AM/PM"
  endTime: string;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  minGapMinutes?: number; // Minimum gap between start and end (default 60)
}

// Convert "HH:MM AM/PM" to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 9 * 60; // Default to 9:00 AM

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'AM' && hours === 12) {
    hours = 0;
  } else if (period === 'PM' && hours !== 12) {
    hours += 12;
  }

  return hours * 60 + minutes;
};

// Convert minutes since midnight to "HH:MM AM/PM"
const minutesToTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;

  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;

  const period = hours24 < 12 ? 'AM' : 'PM';
  const paddedHours = hours12.toString().padStart(2, '0');
  const paddedMinutes = minutes.toString().padStart(2, '0');

  return `${paddedHours}:${paddedMinutes} ${period}`;
};

export const TimeRangeSlider: React.FC<TimeRangeSliderProps> = ({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  minGapMinutes = 60,
}) => {
  const trackWidth = useSharedValue(0);
  const startX = useSharedValue(0);
  const endX = useSharedValue(0);
  const activeThumb = useRef<'start' | 'end' | null>(null);
  const containerRef = useRef<View>(null);
  const containerX = useRef(0);
  const lastStartValue = useRef(timeToMinutes(startTime));
  const lastEndValue = useRef(timeToMinutes(endTime));

  // Convert minutes to position
  const minutesToPosition = useCallback((minutes: number, width: number) => {
    const ratio = (minutes - MIN_TIME) / (MAX_TIME - MIN_TIME);
    return ratio * (width - THUMB_SIZE);
  }, []);

  // Convert position to minutes
  const positionToMinutes = useCallback((pos: number, width: number) => {
    const ratio = pos / (width - THUMB_SIZE);
    const rawMinutes = MIN_TIME + ratio * (MAX_TIME - MIN_TIME);
    const steppedMinutes = Math.round(rawMinutes / STEP) * STEP;
    return Math.min(Math.max(steppedMinutes, MIN_TIME), MAX_TIME);
  }, []);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      trackWidth.value = width;

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      startX.value = minutesToPosition(startMinutes, width);
      endX.value = minutesToPosition(endMinutes, width);
    },
    [trackWidth, startX, endX, startTime, endTime, minutesToPosition],
  );

  const measureContainer = useCallback(() => {
    containerRef.current?.measure((x, y, width, height, pageX) => {
      containerX.current = pageX;
    });
  }, []);

  const updateStartTime = useCallback(
    (minutes: number) => {
      onStartTimeChange(minutesToTime(minutes));
    },
    [onStartTimeChange],
  );

  const updateEndTime = useCallback(
    (minutes: number) => {
      onEndTimeChange(minutesToTime(minutes));
    },
    [onEndTimeChange],
  );

  const updatePosition = useCallback(
    (pageX: number) => {
      if (trackWidth.value === 0 || !activeThumb.current) return;

      const localX = pageX - containerX.current - THUMB_SIZE / 2;
      const clampedX = Math.min(
        Math.max(localX, 0),
        trackWidth.value - THUMB_SIZE,
      );

      const currentMinutes = positionToMinutes(clampedX, trackWidth.value);

      if (activeThumb.current === 'start') {
        // Ensure start doesn't go past end - minGap
        const maxStartMinutes =
          positionToMinutes(endX.value, trackWidth.value) - minGapMinutes;
        const constrainedMinutes = Math.min(currentMinutes, maxStartMinutes);
        const newPosition = minutesToPosition(
          constrainedMinutes,
          trackWidth.value,
        );
        startX.value = newPosition;

        if (constrainedMinutes !== lastStartValue.current) {
          triggerHaptic('selection');
          lastStartValue.current = constrainedMinutes;
          runOnJS(updateStartTime)(constrainedMinutes);
        }
      } else {
        // Ensure end doesn't go before start + minGap
        const minEndMinutes =
          positionToMinutes(startX.value, trackWidth.value) + minGapMinutes;
        const constrainedMinutes = Math.max(currentMinutes, minEndMinutes);
        const newPosition = minutesToPosition(
          constrainedMinutes,
          trackWidth.value,
        );
        endX.value = newPosition;

        if (constrainedMinutes !== lastEndValue.current) {
          triggerHaptic('selection');
          lastEndValue.current = constrainedMinutes;
          runOnJS(updateEndTime)(constrainedMinutes);
        }
      }
    },
    [
      trackWidth,
      startX,
      endX,
      positionToMinutes,
      minutesToPosition,
      minGapMinutes,
      updateStartTime,
      updateEndTime,
    ],
  );

  const handleResponderGrant = useCallback(
    (event: GestureResponderEvent) => {
      measureContainer();
      const touchX = event.nativeEvent.pageX - containerX.current;

      // Determine which thumb is closer to the touch
      const startThumbCenter = startX.value + THUMB_SIZE / 2;
      const endThumbCenter = endX.value + THUMB_SIZE / 2;

      const distToStart = Math.abs(touchX - startThumbCenter);
      const distToEnd = Math.abs(touchX - endThumbCenter);

      activeThumb.current = distToStart < distToEnd ? 'start' : 'end';
      updatePosition(event.nativeEvent.pageX);
    },
    [measureContainer, startX, endX, updatePosition],
  );

  const handleResponderMove = useCallback(
    (event: GestureResponderEvent) => {
      updatePosition(event.nativeEvent.pageX);
    },
    [updatePosition],
  );

  const handleResponderRelease = useCallback(() => {
    // Snap to stepped position with animation
    if (activeThumb.current === 'start') {
      const currentMinutes = positionToMinutes(startX.value, trackWidth.value);
      startX.value = withSpring(
        minutesToPosition(currentMinutes, trackWidth.value),
        SPRING_CONFIG,
      );
    } else if (activeThumb.current === 'end') {
      const currentMinutes = positionToMinutes(endX.value, trackWidth.value);
      endX.value = withSpring(
        minutesToPosition(currentMinutes, trackWidth.value),
        SPRING_CONFIG,
      );
    }
    activeThumb.current = null;
  }, [positionToMinutes, minutesToPosition, startX, endX, trackWidth]);

  const animatedStartThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startX.value }],
  }));

  const animatedEndThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endX.value }],
  }));

  const animatedFillStyle = useAnimatedStyle(() => ({
    left: startX.value + THUMB_SIZE / 2,
    width: Math.max(0, endX.value - startX.value),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.labelsRow}>
        <View style={styles.timeLabel}>
          <Clock size={16} color={colors.neutral.white} />
          <Text style={styles.timeLabelText}>{startTime}</Text>
        </View>
        <View style={styles.timeLabel}>
          <Text style={styles.timeLabelText}>{endTime}</Text>
          <Clock size={16} color={colors.neutral.white} />
        </View>
      </View>

      <View
        ref={containerRef}
        style={styles.sliderContainer}
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleResponderGrant}
        onResponderMove={handleResponderMove}
        onResponderRelease={handleResponderRelease}
        onResponderTerminate={handleResponderRelease}
      >
        <View style={styles.track}>
          <Animated.View style={[styles.fill, animatedFillStyle]} />
        </View>
        <Animated.View style={[styles.thumb, animatedStartThumbStyle]} />
        <Animated.View style={[styles.thumb, animatedEndThumbStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeLabelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral.white,
  },
  sliderContainer: {
    height: THUMB_SIZE + 8,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.neutral.white,
    overflow: 'visible',
  },
  fill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: colors.primary.blue,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.neutral.white,
    borderWidth: 3,
    borderColor: colors.primary.blue,
    ...Shadows.md,
    ...Platform.select({
      android: { elevation: Shadows.md.elevation },
    }),
  },
});

export default TimeRangeSlider;
