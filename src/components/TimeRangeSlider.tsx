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
const MIN_TIME = 0;
const MAX_TIME = 24 * 60 - 1;
const STEP = 15;

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

export interface TimeRangeSliderProps {
  startTime: string;
  endTime: string;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  minGapMinutes?: number;
}

const timeToMinutes = (timeStr: string): number => {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 9 * 60;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'AM' && hours === 12) hours = 0;
  else if (period === 'PM' && hours !== 12) hours += 12;
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const period = hours24 < 12 ? 'AM' : 'PM';
  return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
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

  const minutesToPosition = useCallback((min: number, width: number) => {
    return ((min - MIN_TIME) / (MAX_TIME - MIN_TIME)) * (width - THUMB_SIZE);
  }, []);

  const positionToMinutes = useCallback((pos: number, width: number) => {
    const ratio = pos / (width - THUMB_SIZE);
    const raw = MIN_TIME + ratio * (MAX_TIME - MIN_TIME);
    const stepped = Math.round(raw / STEP) * STEP;
    return Math.min(Math.max(stepped, MIN_TIME), MAX_TIME);
  }, []);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      trackWidth.value = width;
      startX.value = minutesToPosition(timeToMinutes(startTime), width);
      endX.value = minutesToPosition(timeToMinutes(endTime), width);
    },
    [trackWidth, startX, endX, startTime, endTime, minutesToPosition],
  );

  const measureContainer = useCallback(() => {
    containerRef.current?.measure((x, y, width, height, pageX) => {
      containerX.current = pageX;
    });
  }, []);

  const updateStartTime = useCallback(
    (min: number) => onStartTimeChange(minutesToTime(min)),
    [onStartTimeChange],
  );

  const updateEndTime = useCallback(
    (min: number) => onEndTimeChange(minutesToTime(min)),
    [onEndTimeChange],
  );

  const updatePosition = useCallback(
    (pageX: number) => {
      if (trackWidth.value === 0 || !activeThumb.current) return;
      const localX = pageX - containerX.current - THUMB_SIZE / 2;
      const clampedX = Math.min(Math.max(localX, 0), trackWidth.value - THUMB_SIZE);
      const currentMinutes = positionToMinutes(clampedX, trackWidth.value);

      if (activeThumb.current === 'start') {
        const maxStart = positionToMinutes(endX.value, trackWidth.value) - minGapMinutes;
        const constrained = Math.min(currentMinutes, maxStart);
        startX.value = minutesToPosition(constrained, trackWidth.value);
        if (constrained !== lastStartValue.current) {
          triggerHaptic('selection');
          lastStartValue.current = constrained;
          runOnJS(updateStartTime)(constrained);
        }
      } else {
        const minEnd = positionToMinutes(startX.value, trackWidth.value) + minGapMinutes;
        const constrained = Math.max(currentMinutes, minEnd);
        endX.value = minutesToPosition(constrained, trackWidth.value);
        if (constrained !== lastEndValue.current) {
          triggerHaptic('selection');
          lastEndValue.current = constrained;
          runOnJS(updateEndTime)(constrained);
        }
      }
    },
    [trackWidth, startX, endX, positionToMinutes, minutesToPosition, minGapMinutes, updateStartTime, updateEndTime],
  );

  const handleResponderGrant = useCallback(
    (event: GestureResponderEvent) => {
      measureContainer();
      const touchX = event.nativeEvent.pageX - containerX.current;
      const distToStart = Math.abs(touchX - (startX.value + THUMB_SIZE / 2));
      const distToEnd = Math.abs(touchX - (endX.value + THUMB_SIZE / 2));
      activeThumb.current = distToStart < distToEnd ? 'start' : 'end';
      updatePosition(event.nativeEvent.pageX);
    },
    [measureContainer, startX, endX, updatePosition],
  );

  const handleResponderMove = useCallback(
    (event: GestureResponderEvent) => updatePosition(event.nativeEvent.pageX),
    [updatePosition],
  );

  const handleResponderRelease = useCallback(() => {
    if (activeThumb.current === 'start') {
      const m = positionToMinutes(startX.value, trackWidth.value);
      startX.value = withSpring(minutesToPosition(m, trackWidth.value), SPRING_CONFIG);
    } else if (activeThumb.current === 'end') {
      const m = positionToMinutes(endX.value, trackWidth.value);
      endX.value = withSpring(minutesToPosition(m, trackWidth.value), SPRING_CONFIG);
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
          <Clock size={16} color={colors.white} />
          <Text style={styles.timeLabelText}>{startTime}</Text>
        </View>
        <View style={styles.timeLabel}>
          <Text style={styles.timeLabelText}>{endTime}</Text>
          <Clock size={16} color={colors.white} />
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
  container: { gap: spacing.sm },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timeLabelText: { fontSize: 16, fontWeight: '500', color: colors.white },
  sliderContainer: { height: THUMB_SIZE + 8, justifyContent: 'center' },
  track: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, backgroundColor: colors.white, overflow: 'visible' },
  fill: { position: 'absolute', height: '100%', backgroundColor: colors.skyBlue, borderRadius: TRACK_HEIGHT / 2 },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.skyBlue,
    ...Shadows.md,
    ...Platform.select({ android: { elevation: Shadows.md.elevation } }),
  },
});

export default TimeRangeSlider;
