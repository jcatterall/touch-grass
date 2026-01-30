/**
 * Pagination - Carousel progress indicator with animated dots/bars
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import {
  PaginationSizes,
  PaginationColorSchemes,
  type ColorMode,
  type PaginationVariant,
} from '../theme/theme';

export interface PaginationProps<T> {
  data: T[];
  animValue: SharedValue<number>;
  activeColor?: 'blue' | 'orange';
  variant?: PaginationVariant;
  mode?: ColorMode;
  onPageChange?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface PaginationDotProps {
  index: number;
  animValue: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  variant: PaginationVariant;
}

const PaginationDot: React.FC<PaginationDotProps> = ({
  index,
  animValue,
  activeColor,
  inactiveColor,
  variant,
}) => {
  const sizes = variant === 'dots' ? PaginationSizes.dot : PaginationSizes.bar;
  const inactiveWidth = variant === 'dots' ? sizes.size : (sizes as typeof PaginationSizes.bar).inactiveWidth;
  const activeWidth = sizes.activeWidth;
  const height = variant === 'dots' ? sizes.size : (sizes as typeof PaginationSizes.bar).height;
  const borderRadius = variant === 'dots' ? sizes.size / 2 : (sizes as typeof PaginationSizes.bar).borderRadius;

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [index - 1, index, index + 1];

    const width = interpolate(animValue.value, inputRange, [inactiveWidth, activeWidth, inactiveWidth], Extrapolation.CLAMP);
    const scale = variant === 'dots'
      ? interpolate(animValue.value, inputRange, [1, 1.1, 1], Extrapolation.CLAMP)
      : 1;
    const backgroundColor = interpolateColor(animValue.value, inputRange, [inactiveColor, activeColor, inactiveColor]);

    return { width, backgroundColor, transform: [{ scale }] };
  });

  return <Animated.View style={[styles.dot, { height, borderRadius }, animatedStyle]} />;
};

export function Pagination<T>({
  data,
  animValue,
  activeColor = 'blue',
  variant = 'dots',
  mode = 'light',
  onPageChange,
  style,
  testID,
}: PaginationProps<T>): React.ReactElement {
  const colorScheme = PaginationColorSchemes[mode];
  const activeColorValue = colorScheme.active[activeColor];
  const inactiveColorValue = colorScheme.inactive;
  const spacing = variant === 'dots' ? PaginationSizes.dot.spacing : PaginationSizes.bar.spacing;

  const getCurrentPage = useCallback(() => {
    'worklet';
    return Math.round(animValue.value);
  }, [animValue]);

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const currentPage = Math.round(animValue.value);
      const { actionName } = event.nativeEvent;

      if (actionName === 'increment' && currentPage < data.length - 1) {
        onPageChange?.(currentPage + 1);
      } else if (actionName === 'decrement' && currentPage > 0) {
        onPageChange?.(currentPage - 1);
      }
    },
    [animValue, data.length, onPageChange]
  );

  return (
    <View
      style={[styles.container, { gap: spacing }, style]}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Slide ${getCurrentPage() + 1} of ${data.length}`}
      accessibilityValue={{ min: 1, max: data.length, now: getCurrentPage() + 1 }}
      accessibilityActions={[
        { name: 'increment', label: 'Next slide' },
        { name: 'decrement', label: 'Previous slide' },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
    >
      {data.map((_, index) => (
        <PaginationDot
          key={index}
          index={index}
          animValue={animValue}
          activeColor={activeColorValue}
          inactiveColor={inactiveColorValue}
          variant={variant}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {},
});

export default Pagination;
