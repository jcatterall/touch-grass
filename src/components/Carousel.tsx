/**
 * Carousel - Horizontal carousel with pagination integration
 */

import React, { useCallback, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
  type ViewToken,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Pagination, type PaginationProps } from './Pagination';
import { CarouselSizes, type ColorMode, type PaginationVariant } from '../theme/theme';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList;

export interface CarouselRef {
  scrollToPage: (index: number, animated?: boolean) => void;
  getCurrentPage: () => number;
}

export type PaginationPosition = 'top' | 'bottom' | 'overlay-top' | 'overlay-bottom';

export interface CarouselProps<T> {
  data: T[];
  renderItem: (info: ListRenderItemInfo<T>) => React.ReactElement;
  keyExtractor?: (item: T, index: number) => string;
  itemWidth?: number;
  height?: number;
  showPagination?: boolean;
  paginationPosition?: PaginationPosition;
  paginationVariant?: PaginationVariant;
  paginationActiveColor?: 'blue' | 'orange';
  paginationProps?: Partial<Omit<PaginationProps<T>, 'data' | 'animValue'>>;
  mode?: ColorMode;
  onPageChange?: (index: number) => void;
  onScrollBegin?: () => void;
  onScrollEnd?: (index: number) => void;
  initialPage?: number;
  onAnimValueChange?: (animValue: SharedValue<number>) => void;
  style?: StyleProp<ViewStyle>;
  paginationContainerStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

function CarouselInner<T>(
  {
    data,
    renderItem,
    keyExtractor,
    itemWidth = Dimensions.get('window').width,
    height = CarouselSizes.defaultHeight,
    showPagination = true,
    paginationPosition = 'top',
    paginationVariant = 'dots',
    paginationActiveColor = 'blue',
    paginationProps,
    mode = 'light',
    onPageChange,
    onScrollBegin,
    onScrollEnd,
    initialPage = 0,
    onAnimValueChange,
    style,
    paginationContainerStyle,
    contentContainerStyle,
    testID,
  }: CarouselProps<T>,
  ref: React.Ref<CarouselRef>
) {
  const flatListRef = useRef<FlatList<T>>(null);
  const currentPageRef = useRef(initialPage);
  const scrollX = useSharedValue(initialPage * itemWidth);
  const animValue = useSharedValue(initialPage);

  useEffect(() => {
    onAnimValueChange?.(animValue);
  }, [animValue, onAnimValueChange]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      animValue.value = event.contentOffset.x / itemWidth;
    },
  });

  useImperativeHandle(ref, () => ({
    scrollToPage: (index: number, animated = true) => {
      if (index >= 0 && index < data.length) {
        flatListRef.current?.scrollToOffset({ offset: index * itemWidth, animated });
      }
    },
    getCurrentPage: () => currentPageRef.current,
  }));

  const handleScrollBeginDrag = useCallback(() => {
    onScrollBegin?.();
  }, [onScrollBegin]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newPage = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
      if (newPage !== currentPageRef.current) {
        currentPageRef.current = newPage;
        onPageChange?.(newPage);
      }
      onScrollEnd?.(newPage);
    },
    [itemWidth, onPageChange, onScrollEnd]
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        const newPage = viewableItems[0].index;
        if (newPage !== currentPageRef.current) {
          currentPageRef.current = newPage;
          onPageChange?.(newPage);
        }
      }
    },
    [onPageChange]
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handlePaginationPageChange = useCallback(
    (index: number) => {
      flatListRef.current?.scrollToOffset({ offset: index * itemWidth, animated: true });
    },
    [itemWidth]
  );

  const renderItemWrapper = useCallback(
    (info: ListRenderItemInfo<T>) => <View style={{ width: itemWidth }}>{renderItem(info)}</View>,
    [itemWidth, renderItem]
  );

  const isOverlay = paginationPosition === 'overlay-top' || paginationPosition === 'overlay-bottom';
  const isTop = paginationPosition === 'top' || paginationPosition === 'overlay-top';

  const renderPagination = () => {
    if (!showPagination || data.length <= 1) return null;

    const overlayStyle = isOverlay
      ? [styles.paginationOverlay, isTop ? { top: CarouselSizes.paginationBottomOffset } : { bottom: CarouselSizes.paginationBottomOffset }]
      : styles.paginationStatic;

    return (
      <View style={[overlayStyle, paginationContainerStyle]}>
        <Pagination
          data={data}
          animValue={animValue}
          variant={paginationVariant}
          activeColor={paginationActiveColor}
          mode={mode}
          onPageChange={handlePaginationPageChange}
          {...paginationProps}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {isTop && renderPagination()}
      <View style={{ height }}>
        <AnimatedFlatList
          ref={flatListRef}
          data={data}
          renderItem={renderItemWrapper}
          keyExtractor={keyExtractor ?? ((_, index) => index.toString())}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialScrollIndex={initialPage}
          getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
          contentContainerStyle={contentContainerStyle}
          decelerationRate="fast"
          snapToInterval={itemWidth}
          snapToAlignment="start"
        />
      </View>
      {!isTop && renderPagination()}
    </View>
  );
}

export const Carousel = forwardRef(CarouselInner) as <T>(
  props: CarouselProps<T> & { ref?: React.Ref<CarouselRef> }
) => React.ReactElement;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  paginationOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  paginationStatic: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});

export default Carousel;
