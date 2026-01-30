/**
 * Tooltip - Reusable tooltip component with positioning and animations
 */

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import {
  Spacing,
  Shadows,
  TooltipSizes,
  TooltipColorSchemes,
  TooltipAnimation,
  type ColorMode,
  type TooltipVariant,
  type TooltipPosition,
} from '../theme/theme';

const ANIMATION_CONFIG = {
  duration: TooltipAnimation.duration,
  easing: Easing.bezier(0.4, 0.0, 0.2, 1),
};

interface AnchorMeasurement {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

interface TooltipDimensions {
  width: number;
  height: number;
}

export interface TooltipProps {
  content: string | ReactNode;
  position?: TooltipPosition;
  isVisible: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: TooltipVariant;
  mode?: ColorMode;
  tooltipStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  anchorAccessibilityHint?: string;
  testID?: string;
}

interface ArrowProps {
  position: TooltipPosition;
  color: string;
}

const Arrow: React.FC<ArrowProps> = ({ position, color }) => {
  const arrowSize = TooltipSizes.arrow.size;
  const baseStyle: ViewStyle = {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  };

  const arrowStyles: Record<TooltipPosition, ViewStyle> = {
    top: {
      ...baseStyle,
      borderLeftWidth: arrowSize,
      borderRightWidth: arrowSize,
      borderTopWidth: arrowSize,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: color,
    },
    bottom: {
      ...baseStyle,
      borderLeftWidth: arrowSize,
      borderRightWidth: arrowSize,
      borderBottomWidth: arrowSize,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: color,
    },
    left: {
      ...baseStyle,
      borderTopWidth: arrowSize,
      borderBottomWidth: arrowSize,
      borderLeftWidth: arrowSize,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: color,
    },
    right: {
      ...baseStyle,
      borderTopWidth: arrowSize,
      borderBottomWidth: arrowSize,
      borderRightWidth: arrowSize,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderRightColor: color,
    },
  };

  return <View style={arrowStyles[position]} />;
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  isVisible,
  onClose,
  children,
  variant = 'charcoal',
  mode = 'light',
  tooltipStyle,
  accessibilityLabel,
  anchorAccessibilityHint,
  testID,
}) => {
  const anchorRef = useRef<View>(null);
  const [anchorMeasurement, setAnchorMeasurement] = useState<AnchorMeasurement | null>(null);
  const [tooltipDimensions, setTooltipDimensions] = useState<TooltipDimensions | null>(null);

  const scale = useSharedValue(TooltipAnimation.initialScale);
  const opacity = useSharedValue(0);
  const colorScheme = TooltipColorSchemes[mode][variant];

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchorMeasurement({ pageX: x, pageY: y, width, height });
    });
  }, []);

  const handleTooltipLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setTooltipDimensions({ width, height });
  }, []);

  useEffect(() => {
    if (isVisible) {
      measureAnchor();
    } else {
      scale.value = withTiming(TooltipAnimation.initialScale, ANIMATION_CONFIG);
      opacity.value = withTiming(0, ANIMATION_CONFIG, () => {
        runOnJS(setAnchorMeasurement)(null);
        runOnJS(setTooltipDimensions)(null);
      });
    }
  }, [isVisible, measureAnchor, scale, opacity]);

  useEffect(() => {
    if (anchorMeasurement && tooltipDimensions && isVisible) {
      scale.value = withTiming(TooltipAnimation.finalScale, ANIMATION_CONFIG);
      opacity.value = withTiming(1, ANIMATION_CONFIG);

      const contentText = typeof content === 'string' ? content : accessibilityLabel;
      if (contentText) {
        AccessibilityInfo.announceForAccessibility(contentText);
      }
    }
  }, [anchorMeasurement, tooltipDimensions, isVisible, content, accessibilityLabel, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const calculatePosition = (): ViewStyle => {
    if (!anchorMeasurement || !tooltipDimensions) {
      return { opacity: 0 };
    }

    const { pageX, pageY, width: anchorWidth, height: anchorHeight } = anchorMeasurement;
    const { width: tooltipWidth, height: tooltipHeight } = tooltipDimensions;
    const arrowSize = TooltipSizes.arrow.size;
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const edgePadding = Spacing.xs;

    let left = 0;
    let top = 0;

    switch (position) {
      case 'top':
        left = pageX + anchorWidth / 2 - tooltipWidth / 2;
        top = pageY - tooltipHeight - arrowSize;
        break;
      case 'bottom':
        left = pageX + anchorWidth / 2 - tooltipWidth / 2;
        top = pageY + anchorHeight + arrowSize;
        break;
      case 'left':
        left = pageX - tooltipWidth - arrowSize;
        top = pageY + anchorHeight / 2 - tooltipHeight / 2;
        break;
      case 'right':
        left = pageX + anchorWidth + arrowSize;
        top = pageY + anchorHeight / 2 - tooltipHeight / 2;
        break;
    }

    left = Math.max(edgePadding, Math.min(left, screenWidth - tooltipWidth - edgePadding));
    top = Math.max(edgePadding, Math.min(top, screenHeight - tooltipHeight - edgePadding));

    return { position: 'absolute', left, top };
  };

  const getArrowContainerStyle = (): ViewStyle => {
    const arrowSize = TooltipSizes.arrow.size;
    const arrowContainerStyles: Record<TooltipPosition, ViewStyle> = {
      top: { position: 'absolute', bottom: -arrowSize, left: 0, right: 0, alignItems: 'center' },
      bottom: { position: 'absolute', top: -arrowSize, left: 0, right: 0, alignItems: 'center' },
      left: { position: 'absolute', right: -arrowSize, top: 0, bottom: 0, justifyContent: 'center' },
      right: { position: 'absolute', left: -arrowSize, top: 0, bottom: 0, justifyContent: 'center' },
    };
    return arrowContainerStyles[position];
  };

  const transformOriginStyles: Record<TooltipPosition, ViewStyle> = {
    top: { transformOrigin: 'center bottom' },
    bottom: { transformOrigin: 'center top' },
    left: { transformOrigin: 'right center' },
    right: { transformOrigin: 'left center' },
  };

  return (
    <>
      <View ref={anchorRef} collapsable={false} accessibilityHint={anchorAccessibilityHint ?? 'Tap for more information'}>
        {children}
      </View>

      <Modal visible={isVisible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close tooltip" accessibilityRole="button">
          <Animated.View
            style={[
              styles.tooltipContainer,
              { backgroundColor: colorScheme.background },
              calculatePosition(),
              transformOriginStyles[position],
              animatedStyle,
              tooltipStyle,
            ]}
            onLayout={handleTooltipLayout}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={accessibilityLabel ?? (typeof content === 'string' ? content : undefined)}
            accessibilityLiveRegion="polite"
            testID={testID}
          >
            <View style={getArrowContainerStyle()}>
              <Arrow position={position} color={colorScheme.background} />
            </View>

            {typeof content === 'string' ? (
              <Text style={[styles.text, { color: colorScheme.text }]} allowFontScaling={false}>
                {content}
              </Text>
            ) : (
              content
            )}
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tooltipContainer: {
    borderRadius: TooltipSizes.borderRadius,
    paddingHorizontal: TooltipSizes.padding.horizontal,
    paddingVertical: TooltipSizes.padding.vertical,
    maxWidth: TooltipSizes.maxWidth,
    ...Platform.select({
      ios: {
        shadowColor: Shadows.xl.shadowColor,
        shadowOffset: Shadows.xl.shadowOffset,
        shadowOpacity: Shadows.xl.shadowOpacity,
        shadowRadius: Shadows.xl.shadowRadius,
      },
      android: { elevation: Shadows.xl.elevation },
    }),
  },
  text: {
    fontSize: TooltipSizes.fontSize,
    fontWeight: TooltipSizes.fontWeight,
    textAlign: 'center',
    lineHeight: TooltipSizes.fontSize * 1.4,
    ...Platform.select({
      android: { includeFontPadding: false },
    }),
  },
});

export default Tooltip;
